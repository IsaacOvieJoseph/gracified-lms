const mongoose = require('mongoose');

const applicationMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['personal_teacher', 'root_admin'],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  readByTutor: {
    type: Boolean,
    default: false,
  },
  readByAdmin: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const applicationSchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
  messages: [applicationMessageSchema],
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, { _id: true });

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['student', 'root_admin', 'personal_teacher'],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  readByStudent: {
    type: Boolean,
    default: false,
  },
  readByAdmin: {
    type: Boolean,
    default: false,
  },
  readByTutor: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const tutorRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000,
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  preferredSchedule: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'rejected'],
    default: 'open',
  },
  mode: {
    type: String,
    enum: ['admin', 'direct'],
    default: 'admin',
  },
  published: {
    type: Boolean,
    default: false,
  },
  messages: [messageSchema],
  applications: [applicationSchema],
  referral: {
    tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    tutorName: { type: String, default: null },
    tutorContact: { type: String, default: null },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', default: null },
    classroomName: { type: String, default: null },
    classUrl: { type: String, default: null },
    notes: { type: String, default: '' },
    givenAt: { type: Date, default: null },
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

tutorRequestSchema.index({ studentId: 1, status: 1 });
tutorRequestSchema.index({ status: 1, createdAt: -1 });
tutorRequestSchema.index({ published: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('TutorRequest', tutorRequestSchema);
