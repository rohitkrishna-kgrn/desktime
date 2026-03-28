const express = require('express');
const ProductivityLog = require('../models/ProductivityLog');
const { authenticate, requireAdmin, requireAdminOrManager } = require('../middleware/auth');
const { categorizeApp } = require('../utils/categorize');

const router = express.Router();

/**
 * POST /api/productivity/log
 * Desktop client batch-uploads app usage logs.
 * Body: { logs: [{ appName, windowTitle, durationSeconds, timestamp }] }
 */
router.post('/log', authenticate, async (req, res) => {
  const { logs } = req.body;
  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs array required' });
  }

  const userId = req.user._id;
  const entries = [];

  for (const log of logs.slice(0, 500)) { // max 500 per batch
    if (!log.appName || typeof log.durationSeconds !== 'number') continue;
    const timestamp = log.timestamp ? new Date(log.timestamp) : new Date();
    const date = timestamp.toISOString().slice(0, 10);
    const category = await categorizeApp(log.appName);

    entries.push({
      userId,
      appName: log.appName,
      windowTitle: log.windowTitle || '',
      durationSeconds: Math.max(0, Math.round(log.durationSeconds)),
      category,
      timestamp,
      date,
    });
  }

  if (entries.length > 0) {
    await ProductivityLog.insertMany(entries, { ordered: false });
  }

  return res.status(201).json({ inserted: entries.length });
});

/**
 * GET /api/productivity/summary
 * Returns daily/weekly/monthly productivity summary for the authenticated user.
 * Query: period=daily|weekly|monthly, date=YYYY-MM-DD (base date)
 */
router.get('/summary', authenticate, async (req, res) => {
  const { period = 'daily', date } = req.query;
  const userId = req.user._id;
  const result = await getSummary(userId, period, date);
  return res.json(result);
});

/**
 * GET /api/productivity/summary/:userId — Admin only
 */
router.get('/summary/:userId', authenticate, requireAdminOrManager, async (req, res) => {
  const { period = 'daily', date } = req.query;
  const result = await getSummary(req.params.userId, period, date);
  return res.json(result);
});

/**
 * GET /api/productivity/apps
 * Top apps breakdown for a user in a date range.
 */
router.get('/apps', authenticate, async (req, res) => {
  const result = await getAppBreakdown(req.user._id, req.query);
  return res.json(result);
});

router.get('/apps/:userId', authenticate, requireAdminOrManager, async (req, res) => {
  const result = await getAppBreakdown(req.params.userId, req.query);
  return res.json(result);
});

async function getDateRange(period, baseDate) {
  const base = baseDate ? new Date(baseDate) : new Date();
  base.setHours(0, 0, 0, 0);

  if (period === 'daily') {
    const end = new Date(base);
    end.setHours(23, 59, 59, 999);
    return { from: base, to: end };
  }

  if (period === 'weekly') {
    const dayOfWeek = base.getDay();
    const from = new Date(base);
    from.setDate(from.getDate() - dayOfWeek);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  if (period === 'monthly') {
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    const to = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  return { from: base, to: base };
}

async function getSummary(userId, period, date) {
  const { from, to } = await getDateRange(period, date);

  const agg = await ProductivityLog.aggregate([
    { $match: { userId: new (require('mongoose').Types.ObjectId)(userId), timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$category',
        totalSeconds: { $sum: '$durationSeconds' },
      },
    },
  ]);

  const summary = { productive: 0, unproductive: 0, neutral: 0, idle: 0, total: 0 };
  for (const item of agg) {
    summary[item._id] = item.totalSeconds;
    summary.total += item.totalSeconds;
  }

  // Daily breakdown for chart
  const dailyAgg = await ProductivityLog.aggregate([
    { $match: { userId: new (require('mongoose').Types.ObjectId)(userId), timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { date: '$date', category: '$category' },
        totalSeconds: { $sum: '$durationSeconds' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  const byDay = {};
  for (const item of dailyAgg) {
    const d = item._id.date;
    if (!byDay[d]) byDay[d] = { date: d, productive: 0, unproductive: 0, neutral: 0, idle: 0 };
    byDay[d][item._id.category] = item.totalSeconds;
  }

  return {
    period,
    from,
    to,
    summary,
    dailyBreakdown: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function getAppBreakdown(userId, query) {
  const { period = 'daily', date, limit = 20 } = query;
  const { from, to } = await getDateRange(period, date);

  const agg = await ProductivityLog.aggregate([
    { $match: { userId: new (require('mongoose').Types.ObjectId)(userId), timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$appName',
        totalSeconds: { $sum: '$durationSeconds' },
        category: { $first: '$category' },
      },
    },
    { $sort: { totalSeconds: -1 } },
    { $limit: parseInt(limit) },
  ]);

  return agg.map((a) => ({
    appName: a._id,
    totalSeconds: a.totalSeconds,
    category: a.category,
  }));
}

module.exports = router;
