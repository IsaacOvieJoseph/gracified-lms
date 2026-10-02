const axios = require('axios');
const User = require('../models/User');

/**
 * Sends a push notification to a single user
 * @param {string} userId - ID of the recipient user
 * @param {string} title - Title of the notification
 * @param {string} body - Body message of the notification
 * @param {Object} data - Optional data payload
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId).select('expoPushToken');
    if (!user || !user.expoPushToken) {
      return;
    }

    const payload = {
      to: user.expoPushToken,
      sound: 'default',
      title: title || 'Gracified LMS',
      body: body,
      data: data,
    };

    console.log(`Sending Expo push notification to User ${userId}...`);
    const response = await axios.post('https://exp.host/--/api/v2/push/send', payload, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    console.log('Expo Push notification response:', response.data);
  } catch (error) {
    console.error('Error sending Expo Push notification:', error?.response?.data || error.message);
  }
};

/**
 * Sends batch push notifications to multiple users
 * @param {Array<Object>} notifications - Array of notifications { userId, title, body, data }
 */
const sendPushNotifications = async (notifications) => {
  try {
    if (!notifications || notifications.length === 0) return;

    const userIds = notifications.map(n => n.userId);
    const users = await User.find({ _id: { $in: userIds }, expoPushToken: { $ne: null } }).select('expoPushToken');
    if (users.length === 0) return;

    const userMap = new Map(users.map(u => [u._id.toString(), u.expoPushToken]));
    const payloads = [];

    for (const n of notifications) {
      const token = userMap.get(n.userId.toString());
      if (token) {
        payloads.push({
          to: token,
          sound: 'default',
          title: n.title || 'Gracified LMS',
          body: n.body || n.message,
          data: n.data || { type: n.type, entityId: n.entityId },
        });
      }
    }

    if (payloads.length === 0) return;

    console.log(`Sending ${payloads.length} batch Expo push notifications...`);

    // Chunk payloads by 100 as per Expo limits
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const chunks = chunk(payloads, 100);

    for (const c of chunks) {
      const response = await axios.post('https://exp.host/--/api/v2/push/send', c, {
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      });
      console.log('Expo Batch Push response:', response.data);
    }
  } catch (error) {
    console.error('Error sending batch Expo Push notifications:', error?.response?.data || error.message);
  }
};

module.exports = {
  sendPushNotification,
  sendPushNotifications,
};
