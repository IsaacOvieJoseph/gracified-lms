const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

// Get all pending disbursements (Root Admin)
router.get('/pending', auth, authorize('root_admin'), async (req, res) => {
    try {
        const payments = await Payment.find({ payoutStatus: 'pending' })
            .populate('payoutOwnerId', 'name email bankDetails payoutPreference')
            .populate('userId', 'name email')
            .populate('classroomId', 'name')
            .sort({ paymentDate: -1 });

        res.json({ payments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get disbursement history (Root Admin)
router.get('/history', auth, authorize('root_admin'), async (req, res) => {
    try {
        const payments = await Payment.find({ payoutStatus: { $in: ['approved', 'paid'] } })
            .populate('payoutOwnerId', 'name email bankDetails')
            .populate('userId', 'name email')
            .populate('classroomId', 'name')
            .sort({ payoutApprovedAt: -1 });

        res.json({ payments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Approve and Pay disbursement (Root Admin)
// In a real app, this might initiate a Paystack transfer
router.post('/approve/:paymentId', auth, authorize('root_admin'), async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId).populate('payoutOwnerId');
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        if (payment.payoutStatus !== 'pending') return res.status(400).json({ message: 'Payment is not pending' });

        payment.payoutStatus = 'paid';
        payment.payoutApprovedAt = new Date();
        payment.payoutPaidAt = new Date();
        await payment.save();

        // Notify owner
        if (payment.payoutOwnerId) {
            const owner = payment.payoutOwnerId;

            // In-app notification
            await Notification.create({
                userId: owner._id,
                message: `Disbursement Approved: ₦${payment.amount} for ${payment.classroomId?.name || 'class enrollment'} has been paid to your bank account.`,
                type: 'payout_received',
                entityId: payment._id,
                entityRef: 'Payment'
            });

            // Email notification
            try {
                if (owner.email) {
                    const classroomName = payment.classroomId?.name || 'class enrollment';
                    await sendEmail({
                        to: owner.email,
                        subject: `Payout Approved: ${classroomName} `,
                        html: `
    < div style = "font-family: sans-serif; color: #333;" >
                <h2 style="color: #4f46e5;">Disbursement Notification</h2>
                <p>Hello ${owner.name},</p>
                <p style="font-size: 16px; line-height: 1.5;">Great news! Your payout for <strong>${classroomName}</strong> has been approved and paid.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
                  <p style="margin: 0;"><strong>Amount:</strong> ₦${payment.amount}</p>
                  <p style="margin: 0;"><strong>Status:</strong> Paid</p>
                </div>
                <p style="margin-top: 20px; font-size: 14px;">The funds should reflect in your registered bank account shortly.</p>
              </div >
    `
                    });
                }
            } catch (e) {
                console.error('Error sending payout notification email', e.message);
            }
        }

        res.json({ message: 'Disbursement approved and marked as paid', payment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get current user's (Teacher/School Admin) payout history
router.get('/my-payouts', auth, async (req, res) => {
    try {
        const payouts = await Payment.find({ payoutOwnerId: req.user._id })
            .populate('userId', 'name')
            .populate('classroomId', 'name')
            .sort({ paymentDate: -1 });

        res.json({ payouts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
