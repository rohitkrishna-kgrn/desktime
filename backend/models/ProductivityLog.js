const mongoose = require('mongoose');

const productivityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appName: { type: String, required: true },
    windowTitle: { type: String, default: '' },
    // seconds spent in this window during the interval
    durationSeconds: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['productive', 'unproductive', 'neutral', 'idle'],
      default: 'neutral',
    },
    timestamp: { type: Date, required: true, index: true },
    // Date partition for efficient queries
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
  },
  { timestamps: true }
);

productivityLogSchema.index({ userId: 1, date: 1 });
productivityLogSchema.index({ userId: 1, timestamp: -1 });
productivityLogSchema.index({ userId: 1, category: 1, date: 1 });

module.exports = mongoose.model('ProductivityLog', productivityLogSchema);
