const mongoose = require('mongoose');

const marketingTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true },
    html: { type: String, required: true },
    kind: {
      type: String,
      enum: ['cold', 'followup', 'birthday', 'anniversary', 'festive', 'general'],
      default: 'general',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketingTemplate', marketingTemplateSchema);

