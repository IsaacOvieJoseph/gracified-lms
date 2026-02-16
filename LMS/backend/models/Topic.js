const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  lessonsOutline: {
    type: String,
    trim: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  materials: [{
    type: {
      type: String,
      enum: ['video', 'document', 'link', 'text']
    },
    url: String,
    title: String,
    content: String
  }],
  isPaid: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0
  },
  // Duration configuration
  duration: {
    mode: {
      type: String,
      enum: ['not_sure', 'day', 'week', 'month', 'year'],
      default: 'not_sure'
    },
    value: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  // Topic progression tracking
  status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending'
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  // Calculated end date based on duration (if duration mode is not 'not_sure')
  expectedEndDate: {
    type: Date,
    default: null
  },
  // Manual override for next topic (if set, system uses this instead of order)
  nextTopicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  // Track who marked it as done
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Topic', topicSchema);

