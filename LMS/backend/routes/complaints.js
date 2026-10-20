const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const { sendEmail, emailHeading, emailText, emailInfoBlock, emailButton, emailNote } = require('../utils/email');

const sendComplaintNotification = async (complaint) => {
    try {
        const settings = await Settings.findOne();
        let to = settings?.emailNotifications || process.env.ADMIN_EMAIL;

        if (!to) {
            const admins = await User.find({ role: 'root_admin' }).select('email');
            const emails = admins.map(a => a.email).filter(Boolean);
            if (emails.length) to = emails;
        }

        if (!to) {
            console.warn('Complaint email skipped: no recipient configured (set email notifications address or ADMIN_EMAIL).');
            return;
        }

        const html = `
            ${emailHeading('New Complaint Submitted')}
            ${emailText('A new complaint has been submitted on Gracified LMS.')}
            ${emailInfoBlock('From', `${complaint.userName} (${complaint.userEmail}) · ${complaint.userRole}`)}
            ${emailInfoBlock('Category', complaint.category)}
            ${emailInfoBlock('Subject', complaint.subject)}
            ${emailInfoBlock('Description', complaint.description)}
            ${complaint.pageContext ? emailInfoBlock('Page Context', complaint.pageContext) : ''}
            ${emailInfoBlock('Status', complaint.status)}
            ${emailButton('View in Feedbacks', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/feedbacks`)}
            ${emailNote('This is an automated notification from Gracified LMS. Please do not reply.')}
        `;

        await sendEmail({
            to,
            subject: `New Complaint - ${complaint.subject}`,
            html,
            isSystemEmail: true,
        });
    } catch (err) {
        console.error('Failed to send complaint notification email:', err.message);
    }
};

// In-app notifications: alert admins and confirm receipt to the submitter.
const createComplaintNotifications = async (complaint) => {
    try {
        const admins = await User.find({ role: 'root_admin' }).select('_id');

        if (admins.length) {
            await Notification.insertMany(admins.map((a) => ({
                userId: a._id,
                message: `New ${complaint.category} complaint from ${complaint.userName}: ${complaint.subject}`,
                type: 'complaint',
                entityId: complaint._id,
                entityRef: 'Complaint',
            })));
        }

        await Notification.create({
            userId: complaint.userId,
            message: `Your complaint "${complaint.subject}" has been received and is pending review.`,
            type: 'complaint',
            entityId: complaint._id,
            entityRef: 'Complaint',
        });
    } catch (err) {
        console.error('Failed to create complaint notifications:', err.message);
    }
};

router.post('/', auth, async (req, res) => {
    try {
        const { category = 'General', subject, description, pageContext = '' } = req.body;
        
        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required' });
        }
        
        const complaint = new Complaint({
            userId: req.user._id,
            userName: req.user.name,
            userEmail: req.user.email,
            userRole: req.user.role,
            category,
            subject: subject.trim(),
            description: description.trim(),
            pageContext: pageContext.trim(),
            status: 'pending'
        });
        
        await complaint.save();
        await createComplaintNotifications(complaint);
        sendComplaintNotification(complaint);
        
        res.status(201).json({ message: 'Complaint submitted successfully', complaint });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/', auth, authorize('root_admin'), async (req, res) => {
    try {
        const complaints = await Complaint.find()
            .populate('resolvedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json({ complaints });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/my', auth, async (req, res) => {
    try {
        const complaints = await Complaint.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ complaints });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', auth, authorize('root_admin'), async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const complaint = await Complaint.findById(req.params.id);
        
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }
        
        if (status && ['pending', 'in_progress', 'resolved', 'dismissed'].includes(status)) {
            complaint.status = status;
            if (status === 'resolved' && complaint.status !== 'resolved') {
                complaint.resolvedAt = new Date();
                complaint.resolvedBy = req.user._id;
            }
        }
        
        if (adminNotes !== undefined) {
            complaint.adminNotes = adminNotes;
        }
        
        await complaint.save();
        res.json({ message: 'Complaint updated successfully', complaint });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
