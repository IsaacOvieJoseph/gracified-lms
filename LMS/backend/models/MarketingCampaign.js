const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', required: true },
    delayDays: { type: Number, default: 0, min: 0 }, // days after previous step
  },
  { _id: false }
);

const marketingCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingList', required: true, index: true },
    steps: { type: [stepSchema], default: [] },
    fromName: { type: String, default: 'Gracified LMS' },
    fromEmail: { type: String, default: '' }, // optional override; Brevo sender must be verified
    status: { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'draft', index: true },
    startAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketingCampaign', marketingCampaignSchema);

