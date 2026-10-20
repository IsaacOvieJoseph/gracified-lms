const { messaging } = require('./fcm');
const User = require('../models/User');

/** FCM data payloads must be strings. */
const buildData = (data = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
};

const buildMessage = (token, title, body, data) => ({
  token,
  notification: {
    title: title || 'Gracified LMS',
    body: body || '',
  },
  data: buildData(data),
  android: {
    priority: 'high',
    notification: { sound: 'default' },
  },
  apns: {
    payload: { aps: { sound: 'default' } },
  },
});

/** Removes tokens FCM reports as invalid/unregistered for this user. */
const pruneTokens = async (userId, tokensToRemove) => {
  if (!tokensToRemove.length) return;
  await User.updateOne(
    { _id: userId },
    { $pull: { pushTokens: { token: { $in: tokensToRemove } } } }
  );
};

const collectInvalidTokens = (response, tokens) => {
  const invalid = [];
  (response.responses || []).forEach((result, idx) => {
    if (result.success) return;
    const code = result.error?.code;
    if (
      code === 'messaging/registration-token-not-valid' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/mismatched-credential'
    ) {
      invalid.push(tokens[idx]);
    }
  });
  return invalid;
};

const sendToTokens = async (userId, tokens, title, body, data) => {
  if (!tokens.length) return;
  try {
    const messages = tokens.map((token) => buildMessage(token, title, body, data));
    const response = await messaging().sendEachForMulticast({ messages });
    const invalid = collectInvalidTokens(response, tokens);
    if (invalid.length) await pruneTokens(userId, invalid);
  } catch (error) {
    console.error('FCM send error:', error?.message || error);
  }
};

/**
 * Sends a push notification to a single user across all their devices.
 * @param {string} userId - ID of the recipient user
 * @param {string} title - Title of the notification
 * @param {string} body - Body message of the notification
 * @param {Object} data - Optional data payload (values stringified for FCM)
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId).select('pushTokens');
    if (!user || !user.pushTokens || user.pushTokens.length === 0) return;
    const tokens = user.pushTokens.map((t) => t.token).filter(Boolean);
    await sendToTokens(userId, tokens, title, body, data);
  } catch (error) {
    console.error('Error sending FCM push notification:', error?.message || error);
  }
};

/**
 * Sends batch push notifications to multiple users (one FCM multicast per user).
 * @param {Array<Object>} notifications - Array of { userId, title, body, data }
 */
const sendPushNotifications = async (notifications) => {
  try {
    if (!notifications || notifications.length === 0) return;

    const userIds = [...new Set(notifications.map((n) => String(n.userId)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('pushTokens')
      .lean();

    const tokenMap = new Map();
    for (const u of users) {
      const tokens = (u.pushTokens || []).map((t) => t.token).filter(Boolean);
      if (tokens.length) tokenMap.set(String(u._id), tokens);
    }
    if (tokenMap.size === 0) return;

    for (const n of notifications) {
      const tokens = tokenMap.get(String(n.userId));
      if (!tokens) continue;
      const data = n.data || { type: n.type, entityId: n.entityId };
      await sendToTokens(
        n.userId,
        tokens,
        n.title || 'Gracified LMS',
        n.body || n.message,
        data
      );
    }
  } catch (error) {
    console.error('Error sending batch FCM push notifications:', error?.message || error);
  }
};

module.exports = {
  sendPushNotification,
  sendPushNotifications,
};
