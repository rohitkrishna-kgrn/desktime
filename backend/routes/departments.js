const express = require('express');
const Department = require('../models/Department');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/departments — List all active departments (any authenticated user)
 */
router.get('/', authenticate, async (req, res) => {
  const departments = await Department.find({ isActive: true })
    .populate('managerId', 'name email')
    .sort({ name: 1 });
  return res.json(departments);
});

/**
 * POST /api/departments — Create department (admin only)
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, managerId, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }
    const dept = await Department.create({
      name: name.trim(),
      managerId: managerId || null,
      description: description || '',
    });
    // If a manager is assigned, update that user's role to manager
    if (managerId) {
      await User.findByIdAndUpdate(managerId, { role: 'manager' });
    }
    return res.status(201).json(dept);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/departments/:id — Update department (admin only)
 */
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, managerId, description } = req.body;
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const prevManagerId = dept.managerId ? String(dept.managerId) : null;
    const newManagerId  = managerId !== undefined ? (managerId || null) : prevManagerId;

    if (name?.trim()) dept.name = name.trim();
    if (description !== undefined) dept.description = description;
    dept.managerId = newManagerId;
    await dept.save();

    // Demote old manager back to employee if no longer managing any dept
    if (prevManagerId && prevManagerId !== String(newManagerId)) {
      const stillManages = await Department.findOne({ managerId: prevManagerId, isActive: true });
      if (!stillManages) {
        await User.findByIdAndUpdate(prevManagerId, { role: 'employee' });
      }
    }
    // Promote new manager
    if (newManagerId && newManagerId !== prevManagerId) {
      await User.findByIdAndUpdate(newManagerId, { role: 'manager' });
    }

    const updated = await Department.findById(dept._id).populate('managerId', 'name email');
    return res.json(updated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/departments/:id — Soft-delete department (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    dept.isActive = false;
    await dept.save();

    // Demote manager if they were managing this dept only
    if (dept.managerId) {
      const stillManages = await Department.findOne({ managerId: dept.managerId, isActive: true });
      if (!stillManages) {
        await User.findByIdAndUpdate(dept.managerId, { role: 'employee' });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
