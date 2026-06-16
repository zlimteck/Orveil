const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  appriseUrls: { type: [String], default: [] },
  appriseApiUrl: { type: String, default: 'http://apprise:8000' },
});

module.exports = mongoose.model('Settings', settingsSchema);
