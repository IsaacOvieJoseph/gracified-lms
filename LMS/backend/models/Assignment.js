const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  dueDate: {
    type: Date,
    required: false // Changed from true to false
  },
  maxScore: {
    type: Number,
    default: 100
  },
  assignmentType: {
    type: String,
    enum: ['mcq', 'theory'],
    required: true,
    default: 'theory'
  },
  questions: [
    {
      questionText: {
        type: String,
        required: true
      },
      maxScore: { // Max score for this specific question
        type: Number,
        default: 0
      },
      options: [String], // For MCQ
      correctOption: String, // For MCQ (store the correct option text)
      markingPreference: { // For Theory
        type: String,
        enum: ['ai', 'manual'],
        default: 'manual'
      }
    }
  ],
  publishResultsAt: { // For controlling MCQ result release time
    type: Date,
    default: null
  },
  submissions: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    questionScores: [{
      questionIndex: { type: Number, required: true },
      score: { type: Number, default: 0 },
      feedback: { type: String }
    }],
    answers: mongoose.Schema.Types.Mixed, // Can be String for theory, or [String] for MCQ selected options
    files: [String],
    submittedAt: {
      type: Date,
      default: Date.now
    },
    score: {
      type: Number,
      default: 0 // Default score to 0
    },
    feedback: String,
    status: {
      type: String,
      enum: ['submitted', 'graded', 'returned'],
      default: 'submitted'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  published: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Assignment', assignmentSchema);

