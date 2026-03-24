const express = require('express');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Desktop client is considered active only if it sent a heartbeat in the last 2 minutes.
// This avoids stale DB state when the app is closed between cron runs.
const DESKTOP_STALE_MS = 2 * 60 * 1000; // 2 minutes

function isDesktopActive(user) {
  if (!user.desktopClientActive) return false;
  if (!user.lastDesktopHeartbeat) return false;
  return (Date.now() - new Date(user.lastDesktopHeartbeat).getTime()) < DESKTOP_STALE_MS;
}

/**
 * POST /api/attendance/webhook
 * Receives attendance events from Odoo 18 custom module.
 */
router.post('/webhook', async (req, res) => {
  const secret = req.headers['x-odoo-secret'];
  if (secret !== process.env.ODOO_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, timestamp, location, status, odooAttendanceId } = req.body;
  if (!email || !status || !['check_in', 'check_out'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Block check-in if desktop client is not actively running
  if (status === 'check_in' && !isDesktopActive(user)) {
    return res.status(403).json({
      error: 'Desktop client not active — check-in rejected',
      userId: user._id,
    });
  }

  const ts = timestamp ? new Date(timestamp) : new Date();
  user.currentStatus = status === 'check_in' ? 'checked_in' : 'checked_out';
  if (status === 'check_in') user.lastCheckIn = ts;
  else user.lastCheckOut = ts;
  user.lastAttendanceLocation = location || '';
  await user.save();

  await AttendanceLog.create({
    userId: user._id,
    odooAttendanceId: odooAttendanceId || null,
    status,
    timestamp: ts,
    location: location || '',
    source: 'odoo_webhook',
  });

  return res.json({ success: true, userId: user._id, status: user.currentStatus });
});

/**
 * GET /api/attendance/status
 */
router.get('/status', authenticate, async (req, res) => {
  const user = req.user;
  const clientActive = isDesktopActive(user);

  // Auto-correct DB if client has gone stale
  if (user.desktopClientActive && !clientActive) {
    await User.findByIdAndUpdate(user._id, { desktopClientActive: false });
  }

  return res.json({
    status:              user.currentStatus,
    lastCheckIn:         user.lastCheckIn,
    lastCheckOut:        user.lastCheckOut,
    location:            user.lastAttendanceLocation,
    desktopClientActive: clientActive,
    lastHeartbeat:       user.lastDesktopHeartbeat,
  });
});

/**
 * GET /api/attendance/logs
 */
router.get('/logs', authenticate, async (req, res) => {
  const { from, to, limit = 50 } = req.query;
  const filter = { userId: req.user._id };
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to)   filter.timestamp.$lte = new Date(to);
  }
  const logs = await AttendanceLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(Math.min(parseInt(limit), 200));
  return res.json(logs);
});

/**
 * GET /api/attendance/logs/:userId — Admin only
 */
router.get('/logs/:userId', authenticate, requireAdmin, async (req, res) => {
  const { from, to, limit = 50 } = req.query;
  const filter = { userId: req.params.userId };
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to)   filter.timestamp.$lte = new Date(to);
  }
  const logs = await AttendanceLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(Math.min(parseInt(limit), 200));
  return res.json(logs);
});

/**
 * POST /api/attendance/manual  — Testing only
 */
router.post('/manual', authenticate, async (req, res) => {
  const { action } = req.body;
  if (!['check_in', 'check_out'].includes(action)) {
    return res.status(400).json({ error: 'action must be check_in or check_out' });
  }

  const user = req.user;

  if (!isDesktopActive(user)) {
    return res.status(403).json({
      error: 'Desktop client is not running. Open the DeskTime desktop app first.',
    });
  }

  const ts = new Date();
  user.currentStatus = action === 'check_in' ? 'checked_in' : 'checked_out';
  if (action === 'check_in') user.lastCheckIn = ts;
  else user.lastCheckOut = ts;
  user.lastAttendanceLocation = 'manual';
  await user.save();

  await AttendanceLog.create({
    userId: user._id,
    status: action,
    timestamp: ts,
    location: 'manual',
    source: 'manual',
  });

  return res.json({ success: true, status: user.currentStatus, timestamp: ts });
});

/**
 * POST /api/attendance/heartbeat
 */
router.post('/heartbeat', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    desktopClientActive: true,
    lastDesktopHeartbeat: new Date(),
  });
  return res.json({ ok: true });
});

/**
 * POST /api/attendance/deactivate
 * Called by the desktop client on logout or app quit.
 * Immediately marks the client as inactive so the frontend
 * locks the check-in button without waiting for heartbeat expiry.
 */
router.post('/deactivate', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    desktopClientActive: false,
    lastDesktopHeartbeat: null,
  });
  console.log(`[Attendance] Client deactivated for user: ${req.user.email}`);
  return res.json({ ok: true });
});

module.exports = router;
