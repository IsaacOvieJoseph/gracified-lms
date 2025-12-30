const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const axios = require('axios');

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
                message: `Your disbursement of ${payment.amount} ${payment.currency} for ${payment.classroomId?.name || 'class'} has been approved and paid.`,
                type: 'payment_received',
                entityId: payment._id,
                entityRef: 'Payment'
            });

            // best-effort internal email notify
            try {
                await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/payout-notification`, {
                    userId: owner._id,
                    amount: payment.amount,
                    status: 'paid',
                    classroomId: payment.classroomId
                }, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });
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
