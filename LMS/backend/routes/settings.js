const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { auth } = require('../middleware/auth');

// Get current settings
router.get('/', auth, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Create default settings if not exists
            settings = await Settings.create({
                taxRate: 0,
                vatRate: 0,
                serviceFeeRate: 0
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update settings (Root Admin only)
router.put('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'root_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { taxRate, vatRate, serviceFeeRate, subjects } = req.body;

        let settings = await Settings.findOne();
        if (settings) {
            settings.taxRate = taxRate !== undefined ? taxRate : settings.taxRate;
            settings.vatRate = vatRate !== undefined ? vatRate : settings.vatRate;
            settings.serviceFeeRate = serviceFeeRate !== undefined ? serviceFeeRate : settings.serviceFeeRate;
            if (subjects) settings.subjects = subjects;
            settings.updatedBy = req.user._id;
            await settings.save();
        } else {
            settings = await Settings.create({
                taxRate,
                vatRate,
                serviceFeeRate,
                subjects,
                updatedBy: req.user._id
            });
        }

        res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add a new subject (Accessible to teachers/admins creating classrooms)
router.post('/add-subject', auth, async (req, res) => {
    try {
        const { subject } = req.body;
        if (!subject) return res.status(400).json({ message: 'Subject is required' });

        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({}); // Create default if missing
        }

        // Add if not exists (case-insensitive check best practice, but sticking to exact match for simplicity first or simple normalization)
        const exists = settings.subjects.some(s => s.toLowerCase() === subject.toLowerCase());
        if (!exists) {
            settings.subjects.push(subject);
            await settings.save();
        }

        res.json({ message: 'Subject added', subjects: settings.subjects });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
