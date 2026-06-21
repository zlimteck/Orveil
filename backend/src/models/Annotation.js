const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
  ts:        { type: Date, required: true },
  label:     { type: String, required: true, trim: true },
});

schema.index({ monitorId: 1, ts: 1 });

module.exports = mongoose.model('Annotation', schema);
