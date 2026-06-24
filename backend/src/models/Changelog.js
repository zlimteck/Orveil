const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  monitorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
  version:     { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  deployedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ monitorId: 1, deployedAt: -1 });

module.exports = mongoose.model('Changelog', schema);
