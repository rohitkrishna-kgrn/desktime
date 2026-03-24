const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { checkEmailInOdoo } = require('../utils/odoo');
const { authenticate }     = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

function publicUser(u) {
  return {
    id:          u._id,
    odooId:      u.odooId,
    email:       u.email,
    name:        u.name,
    role:        u.role,
    department:  u.department,
    jobTitle:    u.jobTitle,
    avatarUrl:   u.avatarUrl,
    currentStatus: u.currentStatus,
  };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const normalised = email.trim().toLowerCase();

  // 1. Check DeskTime DB — no duplicates
  const existing = await User.findOne({ email: normalised });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  // 2. Verify the email exists in Odoo
  let odooInfo = null;
  try {
    odooInfo = await checkEmailInOdoo(normalised);
  } catch {
    return res.status(503).json({
      error: 'Could not verify email with Odoo. Please try again or contact your admin.',
    });
  }

  if (!odooInfo.exists) {
    return res.status(403).json({
      error: 'This email is not registered in the company system (Odoo). Contact your admin.',
    });
  }

  // 3. Create user — name comes from Odoo if not provided
  const user = await User.create({
    odooId:     odooInfo.odooId,
    email:      normalised,
    password,                         // hashed by the pre-save hook
    name:       (name || '').trim() || odooInfo.name,
    role:       'employee',
    department: odooInfo.department,
    jobTitle:   odooInfo.jobTitle,
  });

  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Must include password (it has select:false)
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await user.verifyPassword(password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  return res.json({ token, user: publicUser(user) });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    id:            u._id,
    odooId:        u.odooId,
    email:         u.email,
    name:          u.name,
    role:          u.role,
    department:    u.department,
    jobTitle:      u.jobTitle,
    avatarUrl:     u.avatarUrl,
    currentStatus: u.currentStatus,
    lastCheckIn:   u.lastCheckIn,
    lastCheckOut:  u.lastCheckOut,
    desktopClientActive: u.desktopClientActive,
  });
});

module.exports = router;
