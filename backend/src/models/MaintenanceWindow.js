const mongoose = require('mongoose');

const maintenanceWindowSchema = new mongoose.Schema({
  monitorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true, index: true },
  scheduledStart: { type: Date, default: null },
  startedAt:      { type: Date, required: true },
  endedAt:        { type: Date, default: null },
  canceledAt:     { type: Date, default: null },
}, { timestamps: false });

module.exports = mongoose.model('MaintenanceWindow', maintenanceWindowSchema);
