const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
  type:      { type: String },
  status:    { type: String },
  value:     { type: Number, default: null },
  metrics:   { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: 'ts', updatedAt: false } });

schema.index({ monitorId: 1, ts: -1 });
schema.index({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
// Covers the all-monitors aggregation (daily uptime + dashboard history)
schema.index({ ts: 1, monitorId: 1, status: 1 });

module.exports = mongoose.model('MetricSnapshot', schema);
