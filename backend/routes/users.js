const express = require('express');
const User = require('../models/User');
const AppRule = require('../models/AppRule');
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
