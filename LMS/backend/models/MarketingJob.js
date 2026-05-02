const mongoose = require('mongoose');

const marketingJobSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['bulk_send'], required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },

    payload: {
      templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', required: true },
      recipientIds: [{ type: String }], // can include "user:<id>" and contact ids
    },

    progress: {
      total: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      lastError: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketingJob', marketingJobSchema);

