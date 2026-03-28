const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // odooId is optional — populated if we can look it up, but not required for auth
    odooId: { type: Number, default: null },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // hashed, never returned by default
    name: { type: String, required: true },
    role: { type: String, enum: ['employee', 'admin', 'manager'], default: 'employee' },
    department: { type: String, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    jobTitle: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },

    // Attendance state pushed from Odoo via webhook
    currentStatus: {
      type: String,
      enum: ['checked_in', 'checked_out', 'unknown'],
      default: 'unknown',
    },
    lastCheckIn: { type: Date, default: null },
    lastCheckOut: { type: Date, default: null },
    lastAttendanceLocation: { type: String, default: '' },

    // Break state
    onBreak: { type: Boolean, default: false },
    currentBreakStart: { type: Date, default: null },
    currentBreakReason: { type: String, default: '' },

    // Desktop client state
    desktopClientActive: { type: Boolean, default: false },
    lastDesktopHeartbeat: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ currentStatus: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain password against hash
userSchema.methods.verifyPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
