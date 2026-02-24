const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Classroom = require('../models/Classroom');
const Topic = require('../models/Topic');
const User = require('../models/User');
const Notification = require('../models/Notification'); // Import Notification model
const axios = require('axios'); // Ensure axios is imported here
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const Settings = require('../models/Settings');
const router = express.Router();

// Helper: calculate payout breakdown based on platform settings
async function calculatePayoutBreakdown(amount) {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = { taxRate: 0, vatRate: 0, serviceFeeRate: 0 };
    }

    const taxAmount = (amount * settings.taxRate) / 100;
    const vatAmount = (amount * settings.vatRate) / 100;
    const serviceFeeAmount = (amount * settings.serviceFeeRate) / 100;
    const payoutAmount = amount - (taxAmount + vatAmount + serviceFeeAmount);

    return {
      taxRate: settings.taxRate,
      vatRate: settings.vatRate,
      serviceFeeRate: settings.serviceFeeRate,
      taxAmount,
      vatAmount,
      serviceFeeAmount,
      payoutAmount
    };
  } catch (err) {
    console.error('Error calculating payout breakdown:', err.message);
    return {
      taxRate: 0, vatRate: 0, serviceFeeRate: 0,
      taxAmount: 0, vatAmount: 0, serviceFeeAmount: 0,
      payoutAmount: amount
    };
  }
}

// Helper: notify recipients (in-app + email notify)
async function notifyRecipients({ payerUser, payment, classroom }) {
  try {
    const recipients = [];

    // 1. Root admins (platform owners)
    const rootAdmins = await User.find({ role: 'root_admin' });
    rootAdmins.forEach(r => recipients.push({ user: r, role: 'root_admin' }));

    // 2. Classroom teacher (personal teacher)
    if (classroom && classroom.teacherId) {
      const teacher = await User.findById(classroom.teacherId);
      if (teacher) recipients.push({ user: teacher, role: 'teacher' });
    }

    // 3. School admin
    if (classroom && classroom.schoolId && classroom.schoolId.length > 0) {
      const School = require('../models/School');
      // Handle potential array or single ID
      const sId = Array.isArray(classroom.schoolId) ? classroom.schoolId[0] : classroom.schoolId;
      const school = await School.findById(sId);
      if (school && school.adminId) {
        const sAdmin = await User.findById(school.adminId);
        if (sAdmin) recipients.push({ user: sAdmin, role: 'school_admin' });
      }
    }

    // 4. The student/payer - they should also get a notification
    if (payerUser) {
      recipients.push({ user: payerUser, role: payerUser.role });
    }

    // Deduplicate recipients by ID
    const uniqueRecipients = [];
    const seenIds = new Set();
    for (const r of recipients) {
      const sid = String(r.user._id);
      if (!seenIds.has(sid)) {
        seenIds.add(sid);
        uniqueRecipients.push(r);
      }
    }

    for (const { user, role } of uniqueRecipients) {
      let message = '';
      let type = 'payment_received';
      const isSubscription = payment.type === 'subscription';

      if (role === 'root_admin') {
        message = `System Alert: ${isSubscription ? 'New Subscription' : payment.type === 'topic_access' ? 'Topic Access Purchase' : 'Class Enrollment'} of ${payment.amount} ${payment.currency || 'NGN'} from ${payerUser?.name || 'user'}.`;
      } else if (role === 'school_admin' || role === 'personal_teacher') {
        if (String(user._id) === String(payerUser?._id)) {
          // They are the ones who paid (for subscription or potentially admin-student enrollment?)
          message = `Payment Successful: Your ${payment.type.replace('_', ' ')} is now active. Total Paid: ${payment.amount} ${payment.currency || 'NGN'}.`;
          type = 'subscription_success';
        } else {
          // Someone else paid for their class
          if (payment.type === 'topic_access') {
            const topicName = payment.metadata?.get?.('allTopics') === 'true' ? 'All Topics' : 'a topic';
            message = `Topic Purchase: ${payerUser?.name || 'A student'} purchased access to ${topicName} in ${classroom?.name || 'your class'} (Amount: ${payment.amount} ${payment.currency || 'NGN'}).`;
          } else {
            message = `New Enrollment: ${payerUser?.name || 'A student'} joined ${classroom?.name || 'your class'} (Amount: ${payment.amount} ${payment.currency || 'NGN'}).`;
          }
        }
      } else if (role === 'teacher') {
        if (payment.type === 'topic_access') {
          message = `Topic Purchase: ${payerUser?.name || 'A student'} purchased access to a topic in your class "${classroom?.name || 'Class'}".`;
        } else {
          message = `Class Enrollment: ${payerUser?.name || 'A student'} joined your class "${classroom?.name || 'Class'}".`;
        }
      } else if (role === 'student') {
        if (payment.type === 'topic_access') {
          message = `Topic Access: You have successfully purchased access to ${payment.metadata?.get?.('allTopics') === 'true' ? 'all topics' : 'the topic'} in "${classroom?.name || 'the class'}". Total Paid: ₦${payment.amount}.`;
        } else {
          message = `Enrollment Successful: You have successfully enrolled in "${classroom?.name || 'the class'}". Total Paid: ₦${payment.amount}.`;
        }
        type = 'payment_success';
      } else {
        // Fallback for any other payer role
        message = `Payment Successful: ${payment.type.replace('_', ' ')} completed. Amount: ${payment.amount} ${payment.currency || 'NGN'}.`;
        type = 'payment_success';
      }

      const rid = user._id;

      try {
        await Notification.create({
          userId: rid,
          message,
          type,
          entityId: payment._id,
          entityRef: 'Payment'
        });
      } catch (e) {
        console.error('Error creating in-app notification for recipient', rid, e.message);
      }

      // Email notification
      try {
        if (user.email) {
          await sendEmail({
            to: user.email,
            subject: `Payment Processed: ${isSubscription ? 'Subscription' : 'Class Enrollment'}`,
            classroomId: classroom ? classroom._id : null,
            isSystemEmail: isSubscription,
            html: `
              <h2 style="color: #4f46e5;">Payment Confirmation</h2>
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>${message}</p>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount:</strong> ₦${(payment.amount || 0).toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()} (GMT)</p>
                <p style="margin: 5px 0;"><strong>Type:</strong> ${payment.type.replace('_', ' ').toUpperCase()}</p>
                ${classroom ? `<p style="margin: 5px 0;"><strong>Class:</strong> ${classroom.name}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Reference:</strong> ${payment.paystackReference || payment.stripePaymentId || 'N/A'}</p>
              </div>
              <p>Thank you for choosing Gracified LMS. You can view your invoice in your dashboard.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                 style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; font-weight: bold;">
                Go to Dashboard
              </a>
            `
          });
        }
      } catch (e) {
        console.error('Error sending email notification to', user.email, e.message);
      }
    }
  } catch (err) {
    console.error('notifyRecipients error', err.message);
  }
}

// Paystack integration
// Initiate a Paystack transaction and return authorization URL
router.post('/paystack/initiate', auth, async (req, res) => {
  try {
    const { amount, classroomId, topicId, planId, type, returnUrl } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) return res.status(500).json({ message: 'Paystack not configured' });

    // Paystack expects amount in kobo for NGN (or smallest currency unit). Default to NGN and multiply by 100.
    const currency = process.env.PAYSTACK_CURRENCY || 'NGN';
    let payAmount = amount;
    if (currency === 'NGN' || currency === 'ngn') payAmount = Math.round(amount * 100);

    const payload = {
      email: req.user.email,
      amount: payAmount,
      metadata: {
        userId: req.user._id.toString(),
        type: type || 'class_enrollment',
        classroomId: classroomId || null,
        topicId: (Array.isArray(req.body.topicIds) ? 'multi' : (topicId || null)),
        topicIds: Array.isArray(req.body.topicIds) ? req.body.topicIds.join(',') : '',
        planId: planId || null
      },
      // optional return URL
      ...(returnUrl ? { callback_url: returnUrl } : {})
    };

    const resp = await axios.post('https://api.paystack.co/transaction/initialize', payload, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });

    if (resp.data && resp.data.status) {
      return res.json({ authorization_url: resp.data.data.authorization_url, reference: resp.data.data.reference });
    }
    return res.status(500).json({ message: 'Failed to initialize Paystack transaction' });
  } catch (error) {
    console.error('Paystack initiate error', error.message);
    return res.status(500).json({ message: error.message });
  }
});

// Verify Paystack transaction by reference and process enrollment/payment
router.get('/paystack/verify', auth, async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: 'Missing reference' });
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) return res.status(500).json({ message: 'Paystack not configured' });

    const resp = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });

    if (!(resp.data && resp.data.data && resp.data.data.status === 'success')) {
      return res.status(400).json({ message: 'Payment not successful', data: resp.data });
    }

    const data = resp.data.data;
    const metadata = data.metadata || {};
    const amountReceived = (data.amount !== undefined) ? data.amount : null; // in kobo if NGN
    const currency = data.currency || process.env.PAYSTACK_CURRENCY || 'NGN';
    let normalizedAmount = amountReceived;
    if (currency === 'NGN' && typeof amountReceived === 'number') normalizedAmount = amountReceived / 100;

    // idempotency: if payment with this reference already exists, return it
    let existing = await Payment.findOne({ paystackReference: reference });
    if (existing) {
      return res.json({ message: 'Payment already processed', payment: existing });
    }

    // create payment record
    const payment = new Payment({
      userId: req.user._id,
      type: metadata.type || 'class_enrollment',
      classroomId: metadata.classroomId || null,
      topicId: (metadata.topicId && metadata.topicId !== 'all' && metadata.topicId !== 'multi') ? metadata.topicId : null,
      planId: metadata.planId || null,
      amount: normalizedAmount || 0,
      currency: currency,
      paystackReference: reference,
      status: 'completed'
    });
    if (metadata.topicIds || metadata.topicId === 'all') {
      payment.metadata = metadata;
    }
    await payment.save();

    // handle enrollment or topic access if applicable
    if (payment.type === 'class_enrollment' && payment.classroomId) {
      const classroom = await Classroom.findById(payment.classroomId);
      if (classroom && !classroom.students.includes(req.user._id)) {
        classroom.students.push(req.user._id);
        await classroom.save();

        await User.findByIdAndUpdate(req.user._id, { $addToSet: { enrolledClasses: payment.classroomId } });
      }

      // Set payout owner for disbursement
      if (classroom) {
        let payoutOwnerId = classroom.teacherId;
        const teacher = await User.findById(classroom.teacherId);

        // If teacher is part of a school, payout goes to school admin
        if (teacher && teacher.role === 'teacher' && classroom.schoolId && classroom.schoolId.length > 0) {
          const School = require('../models/School');
          const school = await School.findById(classroom.schoolId[0]);
          if (school && school.adminId) {
            payoutOwnerId = school.adminId;
          }
        }

        const breakdown = await calculatePayoutBreakdown(payment.amount);

        payment.payoutOwnerId = payoutOwnerId;
        payment.payoutStatus = 'pending';
        payment.taxRate = breakdown.taxRate;
        payment.vatRate = breakdown.vatRate;
        payment.serviceFeeRate = breakdown.serviceFeeRate;
        payment.taxAmount = breakdown.taxAmount;
        payment.vatAmount = breakdown.vatAmount;
        payment.serviceFeeAmount = breakdown.serviceFeeAmount;
        payment.payoutAmount = breakdown.payoutAmount;

        await payment.save();
      }
      // notify classroom stakeholders (teacher, school admin, root admins)
      try {
        const payerUser = await User.findById(req.user._id).select('email name _id');
        const classroom = await Classroom.findById(payment.classroomId);
        await notifyRecipients({ payerUser, payment, classroom });
      } catch (notifyErr) {
        console.error('Error notifying recipients after Paystack verify:', notifyErr.message);
      }
    } else if (payment.type === 'topic_access' && payment.classroomId) {
      const classroom = await Classroom.findById(payment.classroomId);
      if (classroom) {
        let payoutOwnerId = classroom.teacherId;
        const teacher = await User.findById(classroom.teacherId);
        if (teacher && teacher.role === 'teacher' && classroom.schoolId && classroom.schoolId.length > 0) {
          const School = require('../models/School');
          const school = await School.findById(classroom.schoolId[0]);
          if (school && school.adminId) payoutOwnerId = school.adminId;
        }
        const breakdown = await calculatePayoutBreakdown(payment.amount);
        payment.payoutOwnerId = payoutOwnerId;
        payment.payoutStatus = 'pending';
        payment.taxRate = breakdown.taxRate;
        payment.vatRate = breakdown.vatRate;
        payment.serviceFeeRate = breakdown.serviceFeeRate;
        payment.taxAmount = breakdown.taxAmount;
        payment.vatAmount = breakdown.vatAmount;
        payment.serviceFeeAmount = breakdown.serviceFeeAmount;
        payment.payoutAmount = breakdown.payoutAmount;
        await payment.save();
      }
      try {
        const payerUser = await User.findById(req.user._id).select('email name _id');
        await notifyRecipients({ payerUser, payment, classroom });
      } catch (notifyErr) {
        console.error('Error notifying recipients after topic access verify:', notifyErr.message);
      }
    } else if (payment.type === 'subscription' && payment.planId) {
      const UserSubscription = require('../models/UserSubscription');
      const SubscriptionPlan = require('../models/SubscriptionPlan');
      const plan = await SubscriptionPlan.findById(payment.planId);
      if (plan) {
        const startDate = new Date();
        let endDate = null;
        if (plan.planType === 'monthly') {
          endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan.planType === 'yearly') {
          endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        const status = plan.planType === 'pay_as_you_go' ? 'pay_as_you_go' : 'active';

        await UserSubscription.findOneAndUpdate(
          { userId: req.user._id },
          { planId: plan._id, status, startDate, endDate, paymentId: payment._id },
          { upsert: true, new: true }
        );

        await User.findByIdAndUpdate(req.user._id, {
          subscriptionPlan: plan._id,
          subscriptionStatus: status,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate
        });
      }

      // notify admins
      try {
        const payerUser = await User.findById(req.user._id).select('email name _id');
        await notifyRecipients({ payerUser, payment, classroom: null });
      } catch (notifyErr) {
        console.error('Error notifying recipients after subscription verify:', notifyErr.message);
      }
    } else {
      // Non-class payments: still notify root admins
      try {
        const payerUser = await User.findById(req.user._id).select('email name _id');
        await notifyRecipients({ payerUser, payment, classroom: null });
      } catch (notifyErr) {
        console.error('Error notifying recipients after Paystack verify (non-class):', notifyErr.message);
      }
    }

    return res.json({ message: 'Payment verified and processed', payment });
  } catch (error) {
    console.error('Paystack verify error', error.message);
    return res.status(500).json({ message: error.message });
  }
});

// Paystack webhook - receives raw body and verifies signature
router.post('/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack webhook called but secret not configured');
      return res.status(500).end();
    }

    const signature = req.headers['x-paystack-signature'] || req.headers['X-Paystack-Signature'];
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.body).digest('hex');
    if (!signature || signature !== hash) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(400).end();
    }

    const event = JSON.parse(req.body.toString());
    if (!event) return res.status(400).end();

    // Only process successful charge events
    const evtName = event.event;
    if (evtName !== 'charge.success' && evtName !== 'transaction.success') {
      return res.status(200).json({ status: 'ignored', event: evtName });
    }

    const data = event.data || {};
    const reference = data.reference;
    const metadata = data.metadata || {};

    if (!reference) return res.status(400).end();

    // idempotency: if payment already exists, acknowledge
    const existing = await Payment.findOne({ paystackReference: reference });
    if (existing) {
      return res.status(200).json({ status: 'ok', message: 'Already processed' });
    }

    const amountReceived = (data.amount !== undefined) ? data.amount : null; // in kobo for NGN
    const currency = data.currency || process.env.PAYSTACK_CURRENCY || 'NGN';
    let normalizedAmount = amountReceived;
    if (currency && currency.toUpperCase() === 'NGN' && typeof amountReceived === 'number') normalizedAmount = amountReceived / 100;

    const payment = new Payment({
      userId: metadata.userId || null,
      type: metadata.type || 'class_enrollment',
      classroomId: metadata.classroomId || null,
      topicId: (metadata.topicId && metadata.topicId !== 'all' && metadata.topicId !== 'multi') ? metadata.topicId : null,
      amount: normalizedAmount || 0,
      paystackReference: reference,
      status: 'completed'
    });
    if (metadata.topicIds || metadata.topicId === 'all') {
      payment.metadata = metadata;
    }

    await payment.save();

    // handle enrollment if applicable (requires metadata.userId)
    try {
      if (payment.type === 'class_enrollment' && payment.classroomId && metadata.userId) {
        const userId = metadata.userId;
        const classroom = await Classroom.findById(payment.classroomId);
        if (classroom && !classroom.students.map(String).includes(String(userId))) {
          classroom.students.push(userId);
          await classroom.save();

          await User.findByIdAndUpdate(userId, { $addToSet: { enrolledClasses: payment.classroomId } });
        }

        // Set payout owner for disbursement
        if (classroom) {
          let payoutOwnerId = classroom.teacherId;
          const teacher = await User.findById(classroom.teacherId);

          if (teacher && teacher.role === 'teacher' && classroom.schoolId && classroom.schoolId.length > 0) {
            const School = require('../models/School');
            const school = await School.findById(classroom.schoolId[0]);
            if (school && school.adminId) {
              payoutOwnerId = school.adminId;
            }
          }

          const breakdown = await calculatePayoutBreakdown(payment.amount);

          payment.payoutOwnerId = payoutOwnerId;
          payment.payoutStatus = 'pending';
          payment.taxRate = breakdown.taxRate;
          payment.vatRate = breakdown.vatRate;
          payment.serviceFeeRate = breakdown.serviceFeeRate;
          payment.taxAmount = breakdown.taxAmount;
          payment.vatAmount = breakdown.vatAmount;
          payment.serviceFeeAmount = breakdown.serviceFeeAmount;
          payment.payoutAmount = breakdown.payoutAmount;

          await payment.save();
        }

        // Notify stakeholders about this enrollment/payment
        try {
          const payerUser = await User.findById(userId).select('email name _id');
          await notifyRecipients({ payerUser, payment, classroom });
        } catch (notifyErr) {
          console.error('Error notifying recipients from webhook:', notifyErr.message);
        }
      } else if (payment.type === 'topic_access' && payment.classroomId && metadata.userId) {
        const classroom = await Classroom.findById(payment.classroomId);
        if (classroom) {
          let payoutOwnerId = classroom.teacherId;
          const teacher = await User.findById(classroom.teacherId);
          if (teacher && teacher.role === 'teacher' && classroom.schoolId && classroom.schoolId.length > 0) {
            const School = require('../models/School');
            const school = await School.findById(classroom.schoolId[0]);
            if (school && school.adminId) payoutOwnerId = school.adminId;
          }
          const breakdown = await calculatePayoutBreakdown(payment.amount);
          payment.payoutOwnerId = payoutOwnerId;
          payment.payoutStatus = 'pending';
          payment.taxRate = breakdown.taxRate;
          payment.vatRate = breakdown.vatRate;
          payment.serviceFeeRate = breakdown.serviceFeeRate;
          payment.taxAmount = breakdown.taxAmount;
          payment.vatAmount = breakdown.vatAmount;
          payment.serviceFeeAmount = breakdown.serviceFeeAmount;
          payment.payoutAmount = breakdown.payoutAmount;
          await payment.save();
        }
        try {
          const payerUser = await User.findById(metadata.userId).select('email name _id');
          await notifyRecipients({ payerUser, payment, classroom });
        } catch (notifyErr) {
          console.error('Error notifying recipients from webhook (topic_access):', notifyErr.message);
        }
      } else if (payment.type === 'subscription' && metadata.planId && metadata.userId) {
        const userId = metadata.userId;
        const UserSubscription = require('../models/UserSubscription');
        const SubscriptionPlan = require('../models/SubscriptionPlan');
        const plan = await SubscriptionPlan.findById(metadata.planId);
        if (plan) {
          const startDate = new Date();
          let endDate = null;
          if (plan.planType === 'monthly') {
            endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
          } else if (plan.planType === 'yearly') {
            endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);
          }

          await UserSubscription.findOneAndUpdate(
            { userId: userId },
            { planId: plan._id, status: 'active', startDate, endDate, paymentId: payment._id },
            { upsert: true, new: true }
          );

          await User.findByIdAndUpdate(userId, {
            subscriptionPlan: plan._id,
            subscriptionStatus: 'active',
            subscriptionStartDate: startDate,
            subscriptionEndDate: endDate
          });
        }
        // notify admins
        try {
          const payerUser = await User.findById(userId).select('email name _id');
          await notifyRecipients({ payerUser, payment, classroom: null });
        } catch (notifyErr) {
          console.error('Error notifying recipients after subscription verify (webhook):', notifyErr.message);
        }
      } else {
        // Non-class or missing metadata: still notify root admins
        try {
          const payerUser = metadata.userId ? await User.findById(metadata.userId).select('email name _id') : null;
          await notifyRecipients({ payerUser, payment, classroom: null });
        } catch (notifyErr) {
          console.error('Error notifying recipients from webhook (non-class):', notifyErr.message);
        }
      }
    } catch (enrollErr) {
      console.error('Error enrolling user from Paystack webhook:', enrollErr.message);
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('Paystack webhook error', err);
    return res.status(500).end();
  }
});
// Create payment intent
router.post('/create-intent', auth, async (req, res) => {
  try {
    const { type, classroomId, topicId, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.user._id.toString(),
        type,
        classroomId: classroomId || '',
        topicId: topicId || ''
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Confirm payment and enroll
router.post('/confirm', auth, async (req, res) => {
  try {
    const { paymentIntentId, type, classroomId, topicId, amount } = req.body;

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Create payment record
    const payment = new Payment({
      userId: req.user._id,
      type,
      classroomId: classroomId || null,
      topicId: topicId || null,
      amount,
      stripePaymentId: paymentIntentId,
      status: 'completed'
    });

    await payment.save();

    const breakdown = await calculatePayoutBreakdown(payment.amount);
    payment.taxRate = breakdown.taxRate;
    payment.vatRate = breakdown.vatRate;
    payment.serviceFeeRate = breakdown.serviceFeeRate;
    payment.taxAmount = breakdown.taxAmount;
    payment.vatAmount = breakdown.vatAmount;
    payment.serviceFeeAmount = breakdown.serviceFeeAmount;
    payment.payoutAmount = breakdown.payoutAmount;

    // Handle enrollment based on type
    if (type === 'class_enrollment' && classroomId) {
      const classroom = await Classroom.findById(classroomId);
      if (classroom) {
        if (!classroom.students.includes(req.user._id)) {
          classroom.students.push(req.user._id);
          await classroom.save();

          await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { enrolledClasses: classroomId }
          });
        }

        // Set payout owner for disbursement
        let payoutOwnerId = classroom.teacherId;
        const teacher = await User.findById(classroom.teacherId);

        if (teacher && teacher.role === 'teacher' && classroom.schoolId && classroom.schoolId.length > 0) {
          const School = require('../models/School');
          const school = await School.findById(classroom.schoolId[0]);
          if (school && school.adminId) {
            payoutOwnerId = school.adminId;
          }
        }

        payment.payoutOwnerId = payoutOwnerId;
        payment.payoutStatus = 'pending';
      }
    }
    await payment.save();

    // Notify relevant parties (teacher, school admin, root admins) when payment saved
    try {
      const payerUser = await User.findById(req.user._id).select('email name _id');
      const classroom = classroomId ? await Classroom.findById(classroomId) : null;
      await notifyRecipients({ payerUser, payment, classroom });
    } catch (notifyErr) {
      console.error('Error notifying recipients after Stripe confirm:', notifyErr.message);
    }

    res.json({ message: 'Payment confirmed and enrollment completed', payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Handle free trial and 0-price PAYG activations (User-facing 'Payment API' for free plans)
router.post('/free-subscription', auth, async (req, res) => {
  try {
    const { planId } = req.body;
    const SubscriptionPlan = require('../models/SubscriptionPlan');
    const UserSubscription = require('../models/UserSubscription');

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });
    if (plan.price > 0) return res.status(400).json({ message: 'This plan requires a paid transaction' });

    const startDate = new Date();
    let endDate = null;
    if (plan.planType === 'trial') {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + (plan.durationDays || 30));
    }

    const status = plan.planType === 'pay_as_you_go' ? 'pay_as_you_go' : 'trial';

    await UserSubscription.findOneAndUpdate(
      { userId: req.user._id },
      { planId: plan._id, status, startDate, endDate },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(req.user._id, {
      subscriptionPlan: plan._id,
      subscriptionStatus: status,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate
    });

    // Create a zero-amount payment record for tracking and invoicing
    const payment = new Payment({
      userId: req.user._id,
      type: 'subscription',
      planId: plan._id,
      amount: 0,
      currency: 'NGN',
      status: 'completed',
      paymentDate: new Date()
    });
    await payment.save();

    // notify admins
    try {
      const payerUser = await User.findById(req.user._id).select('email name _id');
      await notifyRecipients({ payerUser, payment, classroom: null });
    } catch (notifyErr) {
      console.error('Error notifying admins for free sub:', notifyErr.message);
    }

    res.json({
      message: `Successfully subscribed to ${plan.name}`,
      subscriptionStatus: status,
      paymentId: payment._id
    });
  } catch (error) {
    console.error('Free subscription error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    let query = { userId: req.user._id };

    // Root Admin: sees all
    if (req.user.role === 'root_admin') {
      query = {};
    }
    // School Admin: sees own payments + payments for classes in their schools
    else if (req.user.role === 'school_admin') {
      const School = require('../models/School');
      const schools = await School.find({ adminId: req.user._id }).select('_id');
      const schoolIds = schools.map(s => s._id);

      const classrooms = await Classroom.find({ schoolId: { $in: schoolIds } }).select('_id');
      const classroomIds = classrooms.map(c => c._id);

      query = { $or: [{ userId: req.user._id }, { classroomId: { $in: classroomIds } }] };
    }
    // Personal Teacher: sees own payments + payments for their classes
    else if (req.user.role === 'personal_teacher') {
      const classes = await Classroom.find({ teacherId: req.user._id }).select('_id');
      const classIds = classes.map(c => c._id);
      query = { $or: [{ userId: req.user._id }, { classroomId: { $in: classIds } }] };
    }
    // Students / Regular Teachers: see only their own payments (default query)

    const payments = await Payment.find(query)
      .populate('classroomId', 'name')
      .populate('topicId', 'name')
      .populate('planId', 'name')
      .populate('userId', 'name email')
      .sort({ paymentDate: -1 });

    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('classroomId', 'name')
      .populate('topicId', 'name')
      .populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check permissions
    if (payment.userId._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'root_admin' &&
      req.user.role !== 'school_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get paid/unpaid topics and total for a student in a classroom
// Returns: { paidTopics: [...], unpaidTopics: [...], totalUnpaidAmount, allTopics: [...] }
router.get('/topic-status/:classroomId', auth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user._id;
    // Get all topics for the classroom
    const topics = await Topic.find({ classroomId }).select('_id name price isPaid');
    // Get all topic_access payments for this user and classroom
    const payments = await Payment.find({
      userId,
      classroomId,
      type: 'topic_access',
      status: 'completed',
    }).select('topicId paystackReference stripePaymentId metadata');

    // Helper to check if a specific topicId is covered by any payment
    const isTopicPaid = (id) => {
      const topicIdStr = String(id);
      return payments.some(p => {
        // Case 1: Direct single topic access
        if (p.topicId && String(p.topicId) === topicIdStr) return true;

        // Case 2: Multi-topic access via metadata list
        const multiIds = p.metadata?.get?.('topicIds');
        if (multiIds && multiIds.split(',').includes(topicIdStr)) return true;

        // Case 3: Legacy 'all' access (backward compatibility, though we are moving away from it)
        if (!p.topicId && p.metadata?.get?.('allTopics') === 'true') return true;

        return false;
      });
    };

    const paidTopics = [];
    const unpaidTopics = [];
    let totalUnpaidAmount = 0;
    const allTopics = topics.map(topic => {
      const isPaid = isTopicPaid(topic._id);
      const topicObj = {
        _id: topic._id,
        name: topic.name,
        price: topic.price,
        isPaid,
      };
      if (isPaid) paidTopics.push(topicObj);
      else {
        unpaidTopics.push(topicObj);
        totalUnpaidAmount += topic.price || 0;
      }
      return topicObj;
    });
    res.json({ paidTopics, unpaidTopics, totalUnpaidAmount, allTopics });
  } catch (err) {
    console.error('Error in /topic-status/:classroomId', err.message);
    res.status(500).json({ message: 'Failed to get topic payment status' });
  }
});

module.exports = router;

