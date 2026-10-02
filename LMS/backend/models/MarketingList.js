const mongoose = require('mongoose');

const marketingListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    contactIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MarketingContact' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketingList', marketingListSchema);

