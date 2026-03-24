const mongoose = require('mongoose');

const screenshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // GridFS file ID for the actual image
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: 'image/jpeg' },
    sizeBytes: { type: Number, default: 0 },
    timestamp: { type: Date, required: true, index: true },
    // Retention deadline — enforced by the nightly cron, NOT a TTL index.
    // A TTL index runs every 60 s and can race with the cron, orphaning GridFS files.
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

screenshotSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Screenshot', screenshotSchema);
