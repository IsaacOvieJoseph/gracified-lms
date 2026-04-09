const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['class_enrollment', 'topic_access', 'subscription', 'personal_teacher_subscription', 'lecture_access'],
    required: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    default: null
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  callSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CallSession',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    default: null
  },
  stripePaymentId: {
    type: String,
    default: null
  },
  paystackReference: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Map,
    of: String
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'none'],
    default: 'none'
  },
  payoutOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  taxRate: { type: Number, default: 0 },
  vatRate: { type: Number, default: 0 },
  serviceFeeRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  serviceFeeAmount: { type: Number, default: 0 },
  payoutAmount: { type: Number, default: 0 },
  payoutApprovedAt: Date,
  payoutPaidAt: Date,
  payoutReference: String
});

module.exports = mongoose.model('Payment', paymentSchema);

