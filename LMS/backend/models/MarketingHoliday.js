const mongoose = require('mongoose');

const marketingHolidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    day: { type: Number, required: true, min: 1, max: 31, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', required: true },
    enabled: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

marketingHolidaySchema.index({ month: 1, day: 1, enabled: 1 });

module.exports = mongoose.model('MarketingHoliday', marketingHolidaySchema);

