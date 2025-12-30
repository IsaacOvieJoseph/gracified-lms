const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['class_enrollment', 'topic_access', 'subscription', 'personal_teacher_subscription'],
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
  payoutApprovedAt: Date,
  payoutPaidAt: Date,
  payoutReference: String
});

module.exports = mongoose.model('Payment', paymentSchema);

