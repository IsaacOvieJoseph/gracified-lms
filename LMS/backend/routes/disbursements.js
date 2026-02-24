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
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #4f46e5;">Disbursement Notification</h2>
                <p>Hello ${owner.name},</p>
                <p style="font-size: 16px; line-height: 1.5;">Great news! Your payout for <strong>${classroomName}</strong> has been approved and successfully processed.</p>
                
                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; margin-top: 20px;">
                    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
                        <p style="margin: 0; display: flex; justify-content: space-between;">
                            <strong>Total Received:</strong> 
                            <span>₦${amount}</span>
                        </p>
                    </div>
                    
                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;">
                            <span>Service Fee:</span>
                            <span>- ₦${serviceFee}</span>
                        </p>
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;">
                            <span>Tax:</span>
                            <span>- ₦${tax}</span>
                        </p>
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;">
                            <span>VAT:</span>
                            <span>- ₦${vat}</span>
                        </p>
                    </div>
                    
                    <div style="border-top: 2px solid #4f46e5; padding-top: 12px; color: #4f46e5;">
                        <p style="margin: 0; display: flex; justify-content: space-between; font-size: 18px;">
                            <strong>Disbursed Amount:</strong> 
                            <strong>₦${payoutAmount}</strong>
                        </p>
                    </div>
                </div>

                <div style="margin-top: 15px; font-size: 14px; color: #4b5563;">
                    <p style="margin: 4px 0;"><strong>Payer (Student):</strong> ${payment.userId?.name || 'N/A'}</p>
                    <p style="margin: 4px 0;"><strong>Payout Reference:</strong> ${payment.payoutReference}</p>
                </div>

                <div style="margin-top: 25px; padding: 12px; background: #ecfdf5; border-radius: 8px; border: 1px solid #10b981; color: #065f46; text-align: center;">
                    <strong>Status:</strong> Paid
                </div>

                <p style="margin-top: 25px; font-size: 14px; color: #6b7280;">The funds should reflect in your registered bank account shortly. Thank you for trusting us.</p>
            </div>
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
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #4f46e5;">Disbursement Report (Admin)</h2>
                <p>A disbursement has been processed successfully.</p>
                
                <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin-top: 20px;">
                    <p style="margin: 4px 0;"><strong>Class:</strong> ${classroomName}</p>
                    <p style="margin: 4px 0;"><strong>Recipient (Owner):</strong> ${ownerName}</p>
                    <p style="margin: 4px 0;"><strong>Payer (Student):</strong> ${studentName}</p>
                    <p style="margin: 4px 0;"><strong>Total Payment:</strong> ₦${amount}</p>
                    <p style="margin: 4px 0;"><strong>Disbursed Amount:</strong> ₦${payoutAmount}</p>
                    <p style="margin: 4px 0;"><strong>Reference:</strong> ${payment.payoutReference}</p>
                    <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                </div>
            </div>
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
