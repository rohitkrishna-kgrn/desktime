const mongoose = require('mongoose');

const breakLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startTime: { type: Date, required: true },
    endTime:   { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    reason:   { type: String, default: '' },
    category: {
      type: String,
      enum: ['lunch', 'personal_call', 'physical_meeting', 'short_break', 'other'],
      default: 'other',
    },
  },
  { timestamps: true }
);

breakLogSchema.index({ userId: 1, startTime: -1 });

module.exports = mongoose.model('BreakLog', breakLogSchema);
