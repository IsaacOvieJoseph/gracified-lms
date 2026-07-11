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
    enum: [
      'class_reminder',
      'assignment_reminder',
      'assignment_result',
      'payment_success',
      'payment_received',
      'payout_received',
      'new_assignment',
      'new_submission',
      'assignment_graded',
      'subscription_success',
      'student_enrolled', // Added for enrollment notifications
      'topic_activated', // Added for topic activation notifications
      'new_class_created',
      'class_published',
      'classroom_ended',
      'marketing_job'
    ],
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

const { sendPushNotification, sendPushNotifications } = require('../utils/pushNotifications');

notificationSchema.post('save', async function (doc) {
  try {
    sendPushNotification(doc.userId, 'Gracified LMS', doc.message, {
      type: doc.type,
      entityId: doc.entityId,
    });
  } catch (err) {
    console.error('Error triggering post-save push notification:', err.message);
  }
});

notificationSchema.post('insertMany', async function (docs) {
  try {
    const pushPayloads = docs.map(doc => ({
      userId: doc.userId,
      title: 'Gracified LMS',
      body: doc.message,
      data: {
        type: doc.type,
        entityId: doc.entityId,
      }
    }));
    sendPushNotifications(pushPayloads);
  } catch (err) {
    console.error('Error triggering post-insertMany push notification:', err.message);
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
