const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
  type:      { type: String },
  status:    { type: String },
  value:     { type: Number, default: null }, // primary metric (cpu%, ms, etc.)
}, { timestamps: { createdAt: 'ts', updatedAt: false } });

schema.index({ monitorId: 1, ts: -1 });
schema.index({ ts: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = mongoose.model('MetricSnapshot', schema);
