const mongoose = require('mongoose');

const tutorSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    default: null
  },
  subject: {
    type: String,
    default: ''
  },
  chat: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Practice quizzes. The answer key + explanations stay server-side only —
  // students only ever receive the question text/options and their own results.
  quizzes: [{
    title: {
      type: String,
      default: ''
    },
    topicContext: {
      type: String,
      default: ''
    },
    questions: [{
      questionText: {
        type: String,
        required: true
      },
      options: [String],
      correctOption: String,
      explanation: String
    }],
    attempts: [{
      answers: [String],
      score: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      },
      perQuestion: [{
        questionText: String,
        selected: String,
        correct: String,
        isCorrect: Boolean,
        explanation: String
      }],
      summaryFeedback: String,
      submittedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }]
}, { timestamps: true });

tutorSessionSchema.index({ userId: 1, topicId: 1 });

module.exports = mongoose.model('TutorSession', tutorSessionSchema);
