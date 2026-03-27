const express = require('express');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const BreakLog = require('../models/BreakLog');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const BREAK_CATEGORIES = ['lunch', 'personal_call', 'physical_meeting', 'short_break', 'other'];

// Desktop client is considered active only if it sent a heartbeat in the last 2 minutes.
const DESKTOP_STALE_MS = 2 * 60 * 1000;

function isDesktopActive(user) {
  if (!user.desktopClientActive) return false;
  if (!user.lastDesktopHeartbeat) return false;
  return (Date.now() - new Date(user.lastDesktopHeartbeat).getTime()) < DESKTOP_STALE_MS;
}

async function autoEndBreak(user, ts) {
  if (!user.onBreak) return;
  const durationSeconds = Math.round((ts - new Date(user.currentBreakStart)) / 1000);
  await BreakLog.findOneAndUpdate(
    { userId: user._id, endTime: null },
    { endTime: ts, durationSeconds },
    { sort: { startTime: -1 } }
  );
  user.onBreak = false;
  user.currentBreakStart = null;
  user.currentBreakReason = '';
}

/**
 * POST /api/attendance/webhook
 * Receives attendance events from Odoo 18 custom module. No auth required.
 */
router.post('/webhook', async (req, res) => {
  const { email, timestamp, location, status, odooAttendanceId } = req.body;
  if (!email || !status || !['check_in', 'check_out'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Block check-in if desktop client is not actively running
  if (status === 'check_in' && !isDesktopActive(user)) {
    return res.status(403).json({
      error: 'Client is not active',
      userId: user._id,
    });
  }

  const ts = timestamp ? new Date(timestamp) : new Date();

  // Auto-end any active break on check-out
  if (status === 'check_out') await autoEndBreak(user, ts);

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

  if (user.desktopClientActive && !clientActive) {
    await User.findByIdAndUpdate(user._id, { desktopClientActive: false });
  }

  return res.json({
    status:              user.currentStatus,
    onBreak:             user.onBreak,
    currentBreakStart:   user.currentBreakStart,
    currentBreakReason:  user.currentBreakReason,
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

  if (action === 'check_in' && !isDesktopActive(user)) {
    return res.status(403).json({ error: 'Client is not active' });
  }

  const ts = new Date();

  if (action === 'check_out') await autoEndBreak(user, ts);

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
 */
router.post('/deactivate', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    desktopClientActive: false,
    lastDesktopHeartbeat: null,
  });
  console.log(`[Attendance] Client deactivated for user: ${req.user.email}`);
  return res.json({ ok: true });
});

/**
 * POST /api/attendance/break/start
 */
router.post('/break/start', authenticate, async (req, res) => {
  const user = req.user;
  if (user.currentStatus !== 'checked_in') {
    return res.status(400).json({ error: 'Must be checked in to take a break' });
  }
  if (user.onBreak) {
    return res.status(400).json({ error: 'Already on break' });
  }

  const { reason = '', category = 'other' } = req.body;
  const safeCategory = BREAK_CATEGORIES.includes(category) ? category : 'other';
  const now = new Date();

  await User.findByIdAndUpdate(user._id, {
    onBreak: true,
    currentBreakStart: now,
    currentBreakReason: reason,
  });

  await BreakLog.create({
    userId: user._id,
    startTime: now,
    reason,
    category: safeCategory,
  });

  return res.json({ success: true, breakStart: now });
});

/**
 * POST /api/attendance/break/end
 */
router.post('/break/end', authenticate, async (req, res) => {
  const user = req.user;
  if (!user.onBreak) {
    return res.status(400).json({ error: 'Not currently on break' });
  }

  const now = new Date();
  const durationSeconds = Math.round((now - new Date(user.currentBreakStart)) / 1000);

  await User.findByIdAndUpdate(user._id, {
    onBreak: false,
    currentBreakStart: null,
    currentBreakReason: '',
  });

  await BreakLog.findOneAndUpdate(
    { userId: user._id, endTime: null },
    { endTime: now, durationSeconds },
    { sort: { startTime: -1 } }
  );

  return res.json({ success: true, durationSeconds });
});

/**
 * GET /api/attendance/breaks — Today's breaks for the current user
 */
router.get('/breaks', authenticate, async (req, res) => {
  const { date } = req.query;
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  const breaks = await BreakLog.find({
    userId: req.user._id,
    startTime: { $gte: d, $lte: end },
  }).sort({ startTime: 1 });

  return res.json(breaks);
});

/**
 * GET /api/attendance/breaks/:userId — Admin: user's breaks
 */
router.get('/breaks/:userId', authenticate, requireAdmin, async (req, res) => {
  const { date } = req.query;
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  const breaks = await BreakLog.find({
    userId: req.params.userId,
    startTime: { $gte: d, $lte: end },
  }).sort({ startTime: 1 });

  return res.json(breaks);
});

module.exports = router;
