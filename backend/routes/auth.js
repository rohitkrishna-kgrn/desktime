const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Department = require('../models/Department');
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
  // u.departmentId may be a populated object or plain ObjectId
  const deptName = u.departmentId?.name || u.department || '';
  return {
    id:             u._id,
    odooId:         u.odooId,
    email:          u.email,
    name:           u.name,
    role:           u.role,
    department:     u.department,
    departmentId:   u.departmentId?._id || u.departmentId || null,
    departmentName: deptName,
    jobTitle:       u.jobTitle,
    avatarUrl:      u.avatarUrl,
    currentStatus:  u.currentStatus,
  };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalised = email.trim().toLowerCase();

    // 1. No duplicate DeskTime accounts
    const existing = await User.findOne({ email: normalised });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // 2. Email must exist in Odoo
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
    const { departmentId } = req.body;
    const user = await User.create({
      odooId:       odooInfo.odooId,
      email:        normalised,
      password,
      name:         (name || '').trim() || odooInfo.name,
      role:         'employee',
      department:   odooInfo.department,
      departmentId: departmentId || null,
      jobTitle:     odooInfo.jobTitle,
    });

    // Populate department for the response
    await user.populate('departmentId', 'name');
    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Must include password (it has select:false)
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Account exists but has no password — registered via old Odoo-only flow
    if (!user.password) {
      return res.status(401).json({
        error: 'No password set for this account. Please register again to set a password.',
      });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Populate department for the response
    const fullUser = await User.findById(user._id).populate('departmentId', 'name');
    const token = signToken(user);
    return res.json({ token, user: publicUser(fullUser) });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const u = await User.findById(req.user._id).populate('departmentId', 'name');
  res.json({
    id:             u._id,
    odooId:         u.odooId,
    email:          u.email,
    name:           u.name,
    role:           u.role,
    department:     u.department,
    departmentId:   u.departmentId?._id || null,
    departmentName: u.departmentId?.name || u.department || '',
    jobTitle:       u.jobTitle,
    avatarUrl:      u.avatarUrl,
    currentStatus:  u.currentStatus,
    lastCheckIn:    u.lastCheckIn,
    lastCheckOut:   u.lastCheckOut,
    desktopClientActive: u.desktopClientActive,
  });
});

module.exports = router;
