const mongoose = require('mongoose');
const crypto = require('crypto');

const marketingContactSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true, unique: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    company: { type: String, default: '' },
    title: { type: String, default: '' },
    phone: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    source: { type: String, default: 'manual' }, // manual | csv | api

    // Date-based greetings (month/day used, year ignored)
    birthDate: { type: Date, default: null },
    anniversaryDate: { type: Date, default: null },
    timezone: { type: String, default: 'Africa/Lagos' },

    // compliance
    unsubscribed: { type: Boolean, default: false, index: true },
    unsubscribeToken: { type: String, index: true, unique: true, sparse: true },
    unsubscribedAt: { type: Date, default: null },
    lastEmailedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

marketingContactSchema.pre('save', function (next) {
  if (!this.unsubscribeToken) {
    // Short, URL-safe token (not a secret), used only to lookup contact for unsubscribe
    this.unsubscribeToken = crypto.randomBytes(16).toString('hex');
  }
  next();
});

module.exports = mongoose.model('MarketingContact', marketingContactSchema);

