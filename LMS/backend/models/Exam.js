const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School'
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom'
    },
    duration: {
        type: Number, // in minutes
        required: true
    },
    accessMode: {
        type: String,
        enum: ['registered', 'open'],
        default: 'registered'
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    dueDate: {
        type: Date
    },
    questions: [
        {
            questionText: {
                type: String,
                required: true
            },
            questionType: {
                type: String,
                enum: ['mcq', 'theory'],
                default: 'mcq'
            },
            options: [String], // For MCQ
            correctOption: String, // For MCQ
            maxScore: {
                type: Number,
                default: 1
            }
        }
    ],
    isPublished: {
        type: Boolean,
        default: false
    },
    resultsPublished: {
        type: Boolean,
        default: false
    },
    resultPublishTime: {
        type: Date
    },
    linkToken: {
        type: String,
        unique: true,
        default: () => randomUUID().slice(0, 8)
    }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);
