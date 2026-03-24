require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const { resetBucket, getBucket } = require('./utils/gridfs');
const Screenshot = require('./models/Screenshot');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const allowAll = allowedOrigins.includes('*');

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (desktop Electron app, curl, Postman)
    if (!origin) return cb(null, true);
    // Allow all origins when wildcard is set
    if (allowAll) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed for origin: ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/screenshots', require('./routes/screenshots'));
app.use('/api/productivity', require('./routes/productivity'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error Handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Scheduled Jobs ────────────────────────────────────────────────────────────

// Mark desktop clients as inactive if heartbeat is stale (run every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  await User.updateMany(
    { desktopClientActive: true, lastDesktopHeartbeat: { $lt: staleThreshold } },
    { $set: { desktopClientActive: false } }
  );
});

// Clean up orphaned GridFS files (screenshots past expiry) — run daily at 2am
cron.schedule('0 2 * * *', async () => {
  console.log('[Cleanup] Running screenshot cleanup...');
  try {
    const expired = await Screenshot.find({ expiresAt: { $lte: new Date() } });
    const bucket = getBucket();
    let deleted = 0;
    for (const s of expired) {
      try {
        await bucket.delete(s.fileId);
      } catch {
        // File may already be gone
      }
      await Screenshot.deleteOne({ _id: s._id });
      deleted++;
    }
    console.log(`[Cleanup] Deleted ${deleted} expired screenshots`);
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }
});

// ── MongoDB Connection & Start ────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/desktime')
  .then(() => {
    console.log('[DB] Connected to MongoDB');
    resetBucket(); // reset GridFS bucket after connection

    app.listen(PORT, () => {
      console.log(`[Server] DeskTime API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
