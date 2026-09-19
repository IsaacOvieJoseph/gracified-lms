const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const { sendEmail, emailHeading, emailText, emailMeta, emailPanel, emailNote, FOREST } = require('../utils/email');

// Get all pending disbursements (Root Admin)
/**
 * @swagger
 * /api/disbursements/pending:
 *   get:
 *     summary: Get all pending disbursements (Root Admin)
 *     tags: [Disbursements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending payouts
 */
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
/**
 * @swagger
 * /api/disbursements/history:
 *   get:
 *     summary: Get disbursement history (Root Admin)
 *     tags: [Disbursements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of processed payouts
 */
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
/**
 * @swagger
 * /api/disbursements/approve/{paymentId}:
 *   post:
 *     summary: Approve and mark a disbursement as paid (Root Admin)
 *     tags: [Disbursements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payout approved
 */
router.post('/approve/:paymentId', auth, authorize('root_admin'), async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId)
            .populate('payoutOwnerId')
            .populate('userId', 'name email')
            .populate('classroomId');

        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        if (payment.payoutStatus !== 'pending') return res.status(400).json({ message: 'Payment is not pending' });

        payment.payoutStatus = 'paid';
        payment.payoutApprovedAt = new Date();
        payment.payoutPaidAt = new Date();
        payment.payoutReference = `POUT-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await payment.save();

        // Notify owner
        if (payment.payoutOwnerId) {
            const owner = payment.payoutOwnerId;

            // In-app notification
            const displayAmount = (payment.payoutAmount || payment.amount || 0).toLocaleString();
            await Notification.create({
                userId: owner._id,
                message: `Disbursement Approved: ₦${displayAmount} for ${payment.classroomId?.name || 'class enrollment'} has been paid to your bank account.`,
                type: 'payout_received',
                entityId: payment._id,
                entityRef: 'Payment'
            });

            // Email notification
            try {
                if (owner.email) {
                    const classroomName = payment.classroomId?.name || 'class enrollment';
                    const amount = (payment.amount || 0).toLocaleString();
                    const serviceFee = (payment.serviceFeeAmount || 0).toLocaleString();
                    const tax = (payment.taxAmount || 0).toLocaleString();
                    const vat = (payment.vatAmount || 0).toLocaleString();
                    const payoutAmount = (payment.payoutAmount || 0).toLocaleString();

                    await sendEmail({
                        to: owner.email,
                        subject: `Payout Approved: ${classroomName}`,
                        classroomId: payment.classroomId?._id || payment.classroomId,
                        html: `
            ${emailHeading('Disbursement Notification')}
            ${emailText(`Hello <strong>${owner.name}</strong>,`)}
            ${emailText(`Great news! Your payout for <strong>${classroomName}</strong> has been approved and successfully processed.`)}
            ${emailMeta([
              ['Total Received', `₦${amount}`],
              ['Service Fee', `- \u20A6${serviceFee}`],
              ['Tax', `- \u20A6${tax}`],
              ['VAT', `- \u20A6${vat}`],
              ['Disbursed Amount', `₦${payoutAmount}`],
              ['Payer (Student)', payment.userId?.name || 'N/A'],
              ['Payout Reference', payment.payoutReference || 'N/A']
            ])}
            ${emailPanel('Status: Paid', { accent: FOREST })}
            ${emailText('The funds should reflect in your registered bank account shortly. Thank you for trusting us.')}
            ${emailNote('This is an automated notification from Gracified LMS.')}
            `
                    });
                }

                // Notify Root Admins
                const rootAdmins = await User.find({ role: 'root_admin' });
                const rootEmails = rootAdmins.map(admin => admin.email).filter(Boolean);

                if (rootEmails.length > 0) {
                    const classroomName = payment.classroomId?.name || 'class enrollment';
                    const amount = (payment.amount || 0).toLocaleString();
                    const payoutAmount = (payment.payoutAmount || 0).toLocaleString();
                    const ownerName = payment.payoutOwnerId?.name || 'Unknown';
                    const studentName = payment.userId?.name || 'N/A';

                    await sendEmail({
                        to: rootEmails,
                        subject: `Disbursement Processed: ${classroomName}`,
                        classroomId: payment.classroomId?._id || payment.classroomId,
                        html: `
            ${emailHeading('Disbursement Report (Admin)')}
            ${emailText('A disbursement has been processed successfully.')}
            ${emailMeta([
              ['Class', classroomName],
              ['Recipient (Owner)', ownerName],
              ['Payer (Student)', studentName],
              ['Total Payment', `₦${amount}`],
              ['Disbursed Amount', `₦${payoutAmount}`],
              ['Reference', payment.payoutReference || 'N/A'],
              ['Date', new Date().toLocaleString()]
            ])}
            ${emailNote('This is an automated notification from Gracified LMS.')}
            `
                    });
                }
            } catch (e) {
                console.error('Error sending payout notification email(s)', e.message);
            }
        }

        res.json({ message: 'Disbursement approved and marked as paid', payment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get current user's (Teacher/School Admin) payout history
/**
 * @swagger
 * /api/disbursements/my-payouts:
 *   get:
 *     summary: Get current user's payout history (Teacher/School Admin)
 *     tags: [Disbursements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of personal payouts
 */
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
