const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['class_reminder', 'assignment_reminder', 'assignment_result', 'payment_success', 'payment_received', 'payout_received', 'new_assignment', 'new_submission', 'assignment_graded', 'subscription_success'],
    required: true,
  },
  // Optional: Link to the specific resource (e.g., assignment, classroom, payment)
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityRef',
  },
  entityRef: {
    type: String,
    required: function () { return this.entityId != null; },
    enum: ['Assignment', 'Classroom', 'Payment', 'Topic', 'User'],
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
