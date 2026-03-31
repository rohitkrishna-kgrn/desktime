const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const mongoose = require('mongoose');
const { getBucket } = require('../utils/gridfs');
const Screenshot = require('../models/Screenshot');
const { authenticate, requireAdmin, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// Store upload in memory, then compress & stream to GridFS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max raw
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const RETENTION_DAYS = parseInt(process.env.SCREENSHOT_RETENTION_DAYS) || 15;

/**
 * POST /api/screenshots/upload
 * Desktop client uploads a screenshot.
 */
router.post('/upload', authenticate, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  // Verify user is checked in (block if checked out)
  const user = req.user;
  if (user.currentStatus !== 'checked_in') {
    return res.status(403).json({ error: 'User not checked in — screenshot rejected' });
  }

  try {
    // Compress image with Sharp (max 1280px wide, 80% JPEG quality)
    const compressed = await sharp(req.file.buffer)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const bucket = getBucket();
    const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
    const filename = `screenshot_${user._id}_${timestamp.getTime()}.jpg`;

    // Upload to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'image/jpeg',
      metadata: { userId: user._id.toString(), timestamp },
    });

    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
      uploadStream.end(compressed);
    });

    // Calculate TTL expiry
    const expiresAt = new Date(timestamp);
    expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

    // Save metadata
    const screenshot = await Screenshot.create({
      userId: user._id,
      fileId: uploadStream.id,
      filename,
      contentType: 'image/jpeg',
      sizeBytes: compressed.length,
      timestamp,
      expiresAt,
    });

    return res.status(201).json({
      id: screenshot._id,
      timestamp: screenshot.timestamp,
      sizeBytes: screenshot.sizeBytes,
      expiresAt: screenshot.expiresAt,
    });
  } catch (err) {
    console.error('[Screenshots] Upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/screenshots
 * Returns screenshot metadata list for the authenticated user.
 */
router.get('/', authenticate, async (req, res) => {
  const { from, to, limit = 50, page = 1 } = req.query;
  const filter = { userId: req.user._id };
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [screenshots, total] = await Promise.all([
    Screenshot.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Math.min(parseInt(limit), 100))
      .select('-__v'),
    Screenshot.countDocuments(filter),
  ]);

  return res.json({ screenshots, total, page: parseInt(page), limit: parseInt(limit) });
});

/**
 * GET /api/screenshots/:userId — Admin only
 */
router.get('/:userId', authenticate, requireAdminOrManager, async (req, res) => {
  const { from, to, limit = 50, page = 1 } = req.query;
  const filter = { userId: req.params.userId };
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [screenshots, total] = await Promise.all([
    Screenshot.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Math.min(parseInt(limit), 100))
      .select('-__v'),
    Screenshot.countDocuments(filter),
  ]);

  return res.json({ screenshots, total, page: parseInt(page), limit: parseInt(limit) });
});

/**
 * GET /api/screenshots/image/:fileId
 * Streams the actual screenshot image from GridFS.
 */
router.get('/image/:fileId', authenticate, async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);

    // Verify the user owns this screenshot (or is admin)
    const meta = await Screenshot.findOne({ fileId });
    if (!meta) return res.status(404).json({ error: 'Not found' });

    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'manager' &&
      meta.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const bucket = getBucket();
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', () => res.status(404).json({ error: 'File not found' }));
    downloadStream.pipe(res);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
});

/**
 * DELETE /api/screenshots/image/:fileId — Admin only
 */
router.delete('/image/:fileId', authenticate, requireAdmin, async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const bucket = getBucket();
    await bucket.delete(fileId);
    await Screenshot.deleteOne({ fileId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: 'Delete failed' });
  }
});

module.exports = router;
