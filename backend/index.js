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

// Delete screenshots past their retention deadline — runs daily at 2 am.
// Deletes GridFS file first, then the metadata document.
// The Screenshot model uses a plain index on expiresAt (no TTL) so this cron
// is the sole deletion path — nothing runs behind the scenes unexpectedly.
cron.schedule('0 2 * * *', async () => {
  console.log('[Cleanup] Starting screenshot retention cleanup…');
  try {
    const now = new Date();
    // Safety guard: never delete anything created in the last 24 hours,
    // even if expiresAt is somehow wrong.
    const safetyFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const expired = await Screenshot.find({
      expiresAt: { $lte: now },
      createdAt: { $lte: safetyFloor },
    }).select('_id fileId').lean();

    if (expired.length === 0) {
      console.log('[Cleanup] No expired screenshots found.');
      return;
    }

    const bucket = getBucket();
    let deleted = 0;
    let errors  = 0;

    for (const s of expired) {
      try {
        await bucket.delete(s.fileId);
      } catch {
        // GridFS file already gone — still remove the metadata row
        errors++;
      }
      await Screenshot.deleteOne({ _id: s._id });
      deleted++;
    }

    console.log(`[Cleanup] Deleted ${deleted} screenshots (${errors} GridFS misses).`);
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }
});

// ── MongoDB Connection & Start ────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/desktime')
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
