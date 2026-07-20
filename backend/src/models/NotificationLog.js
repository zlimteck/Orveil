const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', default: null },
  monitorName: { type: String, default: 'Système' },
  type: { type: String, default: 'info', enum: ['status_change', 'report', 'error', 'info', 'test', 'alert'] },
  level: { type: String, default: 'info', enum: ['info', 'success', 'warning', 'error'] },
  title: { type: String, required: true },
  message: { type: String, required: true },
  sent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('NotificationLog', logSchema);
