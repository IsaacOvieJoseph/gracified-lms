const mongoose = require('mongoose');

const publicAttendeeSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true,
    index: true
  },
  callSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CallSession',
    default: null
  },
  name: {
    type: String,
    trim: true,
    required: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_payment', 'admitted', 'watched_recording'],
    default: 'admitted'
  },
  accessType: {
    type: String,
    enum: ['live', 'recording'],
    default: 'live'
  },
  amount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  paystackReference: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('PublicAttendee', publicAttendeeSchema);
