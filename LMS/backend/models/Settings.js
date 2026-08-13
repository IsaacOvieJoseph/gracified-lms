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
    subscriptionCheckingEnabled: {
        type: Boolean,
        default: true
    },
    activeAIProvider: {
        type: String,
        enum: ['groq', 'gemini'],
        default: 'groq'
    },
    studentAIEnabled: {
        type: Boolean,
        default: false
    },
    studentAIDailyLimit: {
        type: Number,
        default: 20,
        min: 1,
        max: 1000
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
