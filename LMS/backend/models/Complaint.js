const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  userRole: {
    type: String,
    default: 'student',
  },
  category: {
    type: String,
    enum: [
      'General',
      'Technical Issue',
      'Billing & Payments',
      'Classroom & Lessons',
      'Exams & Grading',
      'Account & Access',
      'Teacher / Staff',
      'Other',
    ],
    default: 'General',
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  pageContext: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'dismissed'],
    default: 'pending',
  },
  adminNotes: {
    type: String,
    default: '',
  },
  resolvedAt: {
    type: Date,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Complaint', complaintSchema);
