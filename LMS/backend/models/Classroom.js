const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  learningOutcomes: {
    type: String,
    trim: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    trim: true
  },
  level: {
    type: String,
    enum: ['Pre-Primary', 'Primary', 'High School', 'Pre-University', 'Undergraduate', 'Postgraduate', 'Professional', 'Vocational', 'Other'],
    default: 'Other'
  },
  schoolId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    default: null
  }],
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  schedule: [ // Changed from String to Array of Objects
    {
      dayOfWeek: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
      },
      startTime: {
        type: String, // Consider using Date for more complex time management if needed
        required: true
      },
      endTime: {
        type: String, // Consider using Date for more complex time management if needed
        required: true
      }
    }
  ],
  capacity: {
    type: Number,
    default: 30
  },
  pricing: {
    type: {
      type: String,
      enum: ['per_lecture', 'per_topic', 'weekly', 'monthly', 'free'],
      default: 'per_lecture'
    },
    amount: {
      type: Number,
      default: 0
    }
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  topics: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  }],
  assignments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment'
  }],
  whiteboardUrl: {
    type: String,
    default: null
  },
  whiteboardActiveAt: {
    type: Date,
    default: null
  },
  published: {
    type: Boolean,
    default: false
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  // Track current active topic
  currentTopicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  shortCode: {
    type: String,
    unique: true,
    sparse: true, // Allow nulls for existing records until updated
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique shortCode before saving
classroomSchema.pre('save', async function (next) {
  if (!this.shortCode) {
    const crypto = require('crypto');
    const generateCode = () => crypto.randomBytes(4).toString('hex'); // 8 characters
    let code = generateCode();

    // Ensure uniqueness (though 8 hex chars is quite large, good to check)
    let exists = await this.constructor.findOne({ shortCode: code });
    while (exists) {
      code = generateCode();
      exists = await this.constructor.findOne({ shortCode: code });
    }
    this.shortCode = code;
  }
  next();
});

module.exports = mongoose.model('Classroom', classroomSchema);

