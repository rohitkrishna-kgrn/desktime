const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const AppRule = require('../models/AppRule');
const ProductivityLog = require('../models/ProductivityLog');
const BreakLog = require('../models/BreakLog');
const Department = require('../models/Department');
const AttendanceLog = require('../models/AttendanceLog');
const Screenshot = require('../models/Screenshot');
const { getBucket } = require('../utils/gridfs');
const { authenticate, requireAdmin, requireAdminOrManager } = require('../middleware/auth');
const { invalidateCache } = require('../utils/categorize');

const router = express.Router();

// ── Shared aggregation helper ─────────────────────────────────────────────────
async function buildOverview(userIds, allUsers) {
  const now = Date.now();
  const STALE_MS = 2 * 60 * 1000;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const todayStr = todayStart.toISOString().slice(0, 10);

  const [prodAgg, breakAgg, breakCatAgg] = await Promise.all([
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
    BreakLog.aggregate([
      { $match: { userId: { $in: userIds }, startTime: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: '$category', count: { $sum: 1 }, totalSeconds: { $sum: '$durationSeconds' } } },
    ]),
  ]);

  const prodMap = {};
  for (const item of prodAgg) {
    const uid = String(item._id.userId);
    if (!prodMap[uid]) prodMap[uid] = { productive: 0, unproductive: 0, neutral: 0, total: 0 };
    prodMap[uid].total += item.totalSeconds;
    if (['productive', 'unproductive', 'neutral'].includes(item._id.category)) {
      prodMap[uid][item._id.category] = item.totalSeconds;
    }
  }

  const breakMap = {};
  for (const item of breakAgg) {
    breakMap[String(item._id)] = item.totalBreakSeconds;
  }

  const enriched = allUsers.map((u) => {
    const uid = String(u._id);
    const stale = !u.lastDesktopHeartbeat || now - new Date(u.lastDesktopHeartbeat).getTime() > STALE_MS;
    const prod = prodMap[uid] || { productive: 0, unproductive: 0, neutral: 0, total: 0 };
    const breakSecs = breakMap[uid] || 0;
    const liveSecs = u.onBreak && u.currentBreakStart
      ? Math.round((now - new Date(u.currentBreakStart).getTime()) / 1000)
      : 0;
    return {
      ...u,
      desktopClientActive: !stale,
      todayProductive:   prod.productive,
      todayUnproductive: prod.unproductive,
      todayNeutral:      prod.neutral,
      todayTotal:        prod.total,
      todayBreak:        breakSecs + liveSecs,
      todayEfficiency:   prod.total > 0 ? Math.round((prod.productive / prod.total) * 100) : 0,
    };
  });

  const checkedIn = enriched.filter((u) => u.currentStatus === 'checked_in').length;
  const onBreak   = enriched.filter((u) => u.onBreak).length;
  const withData  = enriched.filter((u) => u.todayTotal > 0);
  const avgProductivity = withData.length
    ? Math.round(withData.reduce((s, u) => s + u.todayEfficiency, 0) / withData.length)
    : 0;

  const teamProductivity = enriched.reduce(
    (acc, u) => ({
      productive:   acc.productive   + u.todayProductive,
      unproductive: acc.unproductive + u.todayUnproductive,
      neutral:      acc.neutral      + u.todayNeutral,
      break:        acc.break        + u.todayBreak,
    }),
    { productive: 0, unproductive: 0, neutral: 0, break: 0 }
  );

  const CATEGORY_LABELS = {
    lunch: 'Lunch', personal_call: 'Personal Call',
    physical_meeting: 'Physical Meeting', short_break: 'Short Break', other: 'Other',
  };
  const breakCategories = breakCatAgg.map((b) => ({
    category: b._id,
    label:    CATEGORY_LABELS[b._id] || b._id,
    count:    b.count,
    totalSeconds: b.totalSeconds,
  }));

  return {
    stats: { total: enriched.length, checkedIn, onBreak, avgProductivity },
    teamProductivity,
    breakCategories,
    users: enriched,
  };
}

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
    .populate('departmentId', 'name')
    .sort({ currentStatus: 1, name: 1 });

  const now = Date.now();
  const enriched = users.map((u) => {
    const obj = u.toObject();
    const stale = !u.lastDesktopHeartbeat || now - u.lastDesktopHeartbeat.getTime() > 5 * 60 * 1000;
    obj.desktopClientActive = !stale;
    obj.departmentName = u.departmentId?.name || u.department || '';
    return obj;
  });

  return res.json(enriched);
});

/**
 * GET /api/users/overview — Admin: all users with today's productivity + break stats
 */
router.get('/overview', authenticate, requireAdmin, async (req, res) => {
  const users = await User.find({ isActive: true })
    .select('-__v')
    .populate('departmentId', 'name')
    .lean();
  const enrichedUsers = users.map((u) => ({
    ...u,
    departmentName: u.departmentId?.name || u.department || '',
  }));
  const userIds = users.map((u) => u._id);
  const result = await buildOverview(userIds, enrichedUsers);
  return res.json(result);
});

/**
 * GET /api/users/manager-overview — Manager: department users only
 */
router.get('/manager-overview', authenticate, async (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Find the department managed by this user
  const dept = await Department.findOne({ managerId: req.user._id, isActive: true });
  if (!dept) {
    return res.json({
      stats: { total: 0, checkedIn: 0, onBreak: 0, avgProductivity: 0 },
      teamProductivity: { productive: 0, unproductive: 0, neutral: 0, break: 0 },
      breakCategories: [],
      users: [],
      department: null,
    });
  }

  const users = await User.find({ isActive: true, departmentId: dept._id })
    .select('-__v')
    .lean();
  const enrichedUsers = users.map((u) => ({
    ...u,
    departmentName: dept.name,
  }));
  const userIds = users.map((u) => u._id);
  const result = await buildOverview(userIds, enrichedUsers);
  return res.json({ ...result, department: { _id: dept._id, name: dept.name } });
});

/**
 * GET /api/users/:id — Admin/Manager: get single user detail
 */
router.get('/:id', authenticate, requireAdminOrManager, async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-__v')
    .populate('departmentId', 'name');
  if (!user) return res.status(404).json({ error: 'User not found' });

  const obj = user.toObject();
  const now = Date.now();
  const stale = !user.lastDesktopHeartbeat || now - user.lastDesktopHeartbeat.getTime() > 5 * 60 * 1000;
  obj.desktopClientActive = !stale;
  obj.departmentName = user.departmentId?.name || user.department || '';

  return res.json(obj);
});

/**
 * PATCH /api/users/:id — Admin: update user name, password, and/or department
 */
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, password, departmentId } = req.body;
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name && name.trim()) user.name = name.trim();
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      user.password = password;
    }
    if (departmentId !== undefined) {
      user.departmentId = departmentId || null;
    }
    await user.save();
    return res.json({ success: true, id: user._id, name: user.name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/:id — Admin: permanently delete a user and all their data
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const userId = user._id;

    // Delete all screenshots from GridFS + metadata
    const screenshots = await Screenshot.find({ userId }).select('_id fileId').lean();
    const bucket = getBucket();
    await Promise.all(
      screenshots.map(async (s) => {
        try { await bucket.delete(s.fileId); } catch { /* already gone */ }
      })
    );
    await Screenshot.deleteMany({ userId });

    // Delete all other user data
    await Promise.all([
      ProductivityLog.deleteMany({ userId }),
      AttendanceLog.deleteMany({ userId }),
      BreakLog.deleteMany({ userId }),
    ]);

    // Remove user as department manager
    await Department.updateMany({ managerId: userId }, { $set: { managerId: null } });

    // Delete the user document
    await User.deleteOne({ _id: userId });

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
  if (!['employee', 'admin', 'manager'].includes(role)) {
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
