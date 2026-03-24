const mongoose = require('mongoose');

// Configurable app categorization rules
const appRuleSchema = new mongoose.Schema(
  {
    pattern: { type: String, required: true }, // regex or exact app name
    category: {
      type: String,
      enum: ['productive', 'unproductive', 'neutral'],
      required: true,
    },
    matchType: { type: String, enum: ['exact', 'contains', 'regex'], default: 'contains' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppRule', appRuleSchema);
