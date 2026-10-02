const mongoose = require('mongoose');

const marketingSendLogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['campaign_step', 'birthday', 'anniversary', 'festive'], required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingCampaign', default: null, index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingContact', required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', required: true },
    stepIndex: { type: Number, default: null },

    scheduledAt: { type: Date, required: true, index: true },
    sentAt: { type: Date, default: null },
    status: { type: String, enum: ['queued', 'sent', 'failed', 'skipped'], default: 'queued', index: true },
    error: { type: String, default: '' },

    // used to avoid duplicates for greetings, e.g. "birthday:2026"
    dedupeKey: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

marketingSendLogSchema.index(
  { contactId: 1, campaignId: 1, stepIndex: 1 },
  { unique: true, partialFilterExpression: { type: 'campaign_step' } }
);

marketingSendLogSchema.index(
  { dedupeKey: 1, contactId: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

module.exports = mongoose.model('MarketingSendLog', marketingSendLogSchema);

