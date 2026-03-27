const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const AppRule = require('../models/AppRule');
const ProductivityLog = require('../models/ProductivityLog');
const BreakLog = require('../models/BreakLog');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { invalidateCache } = require('../utils/categorize');

const router = express.Router();

/**
 * GET /api/users — Admin: list all users with their current status
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { status, search } = req.query;
  const filter = { isActive: true };

  if (status && ['checked_in', 'checked_out', 'unknown'].includes(status)) {
    filter.currentStatus = status;
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('-__v')
    .sort({ currentStatus: 1, name: 1 });

  // Mark users whose desktop client heartbeat is stale (> 5 minutes)
  const now = Date.now();
  const enriched = users.map((u) => {
    const obj = u.toObject();
    const stale = !u.lastDesktopHeartbeat || now - u.lastDesktopHeartbeat.getTime() > 5 * 60 * 1000;
    obj.desktopClientActive = !stale;
    return obj;
  });

  return res.json(enriched);
});

/**
 * GET /api/users/overview — Admin: all users with today's productivity + break stats
 */
router.get('/overview', authenticate, requireAdmin, async (req, res) => {
  const STALE_MS = 2 * 60 * 1000;
  const now = Date.now();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const todayStr = todayStart.toISOString().slice(0, 10);

  const users = await User.find({ isActive: true }).select('-__v').lean();
  const userIds = users.map((u) => u._id);

  const [prodAgg, breakAgg] = await Promise.all([
    ProductivityLog.aggregate([
      { $match: { userId: { $in: userIds }, date: todayStr } },
      { $group: {
        _id: { userId: '$userId', category: '$category' },
        totalSeconds: { $sum: '$durationSeconds' },
      }},
    ]),
    BreakLog.aggregate([
      { $match: { userId: { $in: userIds }, startTime: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: '$userId', totalBreakSeconds: { $sum: '$durationSeconds' } } },
    ]),
  ]);

  const prodMap = {};
  for (const item of prodAgg) {
    const uid = String(item._id.userId);
    if (!prodMap[uid]) prodMap[uid] = { productive: 0, total: 0 };
    prodMap[uid].total += item.totalSeconds;
    if (item._id.category === 'productive') prodMap[uid].productive = item.totalSeconds;
  }

  const breakMap = {};
  for (const item of breakAgg) {
    breakMap[String(item._id)] = item.totalBreakSeconds;
  }

  const enriched = users.map((u) => {
    const uid = String(u._id);
    const stale = !u.lastDesktopHeartbeat || now - new Date(u.lastDesktopHeartbeat).getTime() > STALE_MS;
    const prod = prodMap[uid] || { productive: 0, total: 0 };
    const breakSecs = breakMap[uid] || 0;
    // Add live break duration if currently on break
    const liveSecs = u.onBreak && u.currentBreakStart
      ? Math.round((now - new Date(u.currentBreakStart).getTime()) / 1000)
      : 0;
    return {
      ...u,
      desktopClientActive: !stale,
      todayProductive: prod.productive,
      todayTotal: prod.total,
      todayBreak: breakSecs + liveSecs,
      todayEfficiency: prod.total > 0 ? Math.round((prod.productive / prod.total) * 100) : 0,
    };
  });

  const checkedIn = enriched.filter((u) => u.currentStatus === 'checked_in').length;
  const onBreak   = enriched.filter((u) => u.onBreak).length;
  const withData  = enriched.filter((u) => u.todayTotal > 0);
  const avgProductivity = withData.length
    ? Math.round(withData.reduce((s, u) => s + u.todayEfficiency, 0) / withData.length)
    : 0;

  return res.json({
    stats: { total: enriched.length, checkedIn, onBreak, avgProductivity },
    users: enriched,
  });
});

/**
 * GET /api/users/:id — Admin: get single user detail
 */
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  const user = await User.findById(req.params.id).select('-__v');
  if (!user) return res.status(404).json({ error: 'User not found' });

  const obj = user.toObject();
  const now = Date.now();
  const stale = !user.lastDesktopHeartbeat || now - user.lastDesktopHeartbeat.getTime() > 5 * 60 * 1000;
  obj.desktopClientActive = !stale;

  return res.json(obj);
});

/**
 * PATCH /api/users/:id — Admin: update user name and/or password
 */
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, password } = req.body;
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name && name.trim()) user.name = name.trim();
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      user.password = password; // pre-save hook hashes it
    }
    await user.save();
    return res.json({ success: true, id: user._id, name: user.name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/:id — Admin: soft-delete (deactivate) a user
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    user.isActive = false;
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/users/:id/role — Admin: change user role
 */
router.patch('/:id/role', authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['employee', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ id: user._id, role: user.role });
});

/**
 * GET /api/users/rules — Admin: get all app categorization rules
 */
router.get('/rules/all', authenticate, requireAdmin, async (req, res) => {
  const rules = await AppRule.find({}).sort({ createdAt: -1 });
  return res.json(rules);
});

/**
 * POST /api/users/rules — Admin: create app rule
 */
router.post('/rules', authenticate, requireAdmin, async (req, res) => {
  const { pattern, category, matchType } = req.body;
  if (!pattern || !category) {
    return res.status(400).json({ error: 'pattern and category required' });
  }
  const rule = await AppRule.create({
    pattern,
    category,
    matchType: matchType || 'contains',
    createdBy: req.user._id,
  });
  invalidateCache();
  return res.status(201).json(rule);
});

/**
 * DELETE /api/users/rules/:id — Admin: delete app rule
 */
router.delete('/rules/:id', authenticate, requireAdmin, async (req, res) => {
  await AppRule.findByIdAndDelete(req.params.id);
  invalidateCache();
  return res.json({ success: true });
});

module.exports = router;
