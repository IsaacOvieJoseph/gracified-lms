const mongoose = require('mongoose');

const tutorialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
  }],
  logoUrl: {
    type: String,
    default: null
  },
}, { timestamps: true });

const Tutorial = mongoose.model('Tutorial', tutorialSchema);

module.exports = Tutorial;
