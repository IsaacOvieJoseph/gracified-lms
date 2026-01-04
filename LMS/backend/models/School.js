const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  adminId: {
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

const School = mongoose.model('School', schoolSchema);

module.exports = School;

