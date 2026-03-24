const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    odooAttendanceId: { type: Number, default: null },
    status: { type: String, enum: ['check_in', 'check_out'], required: true },
    timestamp: { type: Date, required: true, index: true },
    location: { type: String, default: '' },
    source: { type: String, enum: ['odoo_webhook', 'odoo_poll', 'manual'], default: 'odoo_webhook' },
  },
  { timestamps: true }
);

attendanceLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
