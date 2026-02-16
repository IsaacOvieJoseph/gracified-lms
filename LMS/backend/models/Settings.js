const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    taxRate: {
        type: Number,
        default: 0 // percentage
    },
    vatRate: {
        type: Number,
        default: 0 // percentage
    },
    serviceFeeRate: {
        type: Number,
        default: 0 // percentage
    },
    subjects: {
        type: [String],
        default: [
            'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology',
            'Computer Science', 'History', 'Geography', 'Economics',
            'Literature', 'Art', 'Music', 'Physical Education'
        ]
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
