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
  shortCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
}, { timestamps: true });

// Generate unique shortCode before saving
schoolSchema.pre('save', async function (next) {
  if (!this.shortCode) {
    const crypto = require('crypto');
    const generateCode = () => crypto.randomBytes(4).toString('hex'); // 8 characters
    let code = generateCode();

    // Ensure uniqueness
    let exists = await this.constructor.findOne({ shortCode: code });
    while (exists) {
      code = generateCode();
      exists = await this.constructor.findOne({ shortCode: code });
    }
    this.shortCode = code;
  }
  next();
});

const School = mongoose.model('School', schoolSchema);

module.exports = School;

