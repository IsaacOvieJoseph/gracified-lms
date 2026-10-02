const mongoose = require('mongoose');

const examSubmissionSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Null if open access or guest
    },
    candidateName: {
        type: String, // For open access guests
        trim: true
    },
    candidateEmail: {
        type: String, // For open access guests
        trim: true
    },
    answers: [{
        questionIndex: {
            type: Number,
            required: true
        },
        answer: mongoose.Schema.Types.Mixed,
        score: {
            type: Number,
            default: 0
        }
    }],
    totalScore: {
        type: Number,
        default: 0
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    submittedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['in-progress', 'submitted', 'graded'],
        default: 'in-progress'
    },
    timeRemaining: {
        type: Number // in seconds
    },
    emailSent: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('ExamSubmission', examSubmissionSchema);
