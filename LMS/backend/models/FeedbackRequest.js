const mongoose = require('mongoose');

const feedbackRequestSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    classroomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom'
    },
    classroomName: {
        type: String // Store name in case classroom is deleted later (unlikely but good for display)
    },
    type: {
        type: String,
        enum: ['classroom', 'platform'],
        default: 'classroom'
    },
    title: { // For platform feedback context (e.g. "We'd love your thoughts?")
        type: String
    },
    teacherId: { // To know who to show feedback to (optional maybe)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'dismissed'],
        default: 'pending'
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    comment: {
        type: String
    },
    submittedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('FeedbackRequest', feedbackRequestSchema);
