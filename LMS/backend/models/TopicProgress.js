const mongoose = require('mongoose');

const topicProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  // Array of video IDs (from topic.recordedVideos) that the user has watched
  watchedVideoIds: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  // Percentage of videos watched (calculated on update)
  completionPercentage: {
    type: Number,
    default: 0
  },
  lastWatchedAt: {
    type: Date,
    default: Date.now
  },
  // The ID of the video the user was last watching
  lastActiveVideoId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, { timestamps: true });

// Ensure unique progress record per user and topic
topicProgressSchema.index({ userId: 1, topicId: 1 }, { unique: true });

module.exports = mongoose.model('TopicProgress', topicProgressSchema);
