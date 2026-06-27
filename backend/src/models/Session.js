const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  jti:        { type: String, required: true, unique: true },
  username:   { type: String, required: true, index: true },
  userAgent:  { type: String, default: '' },
  ip:         { type: String, default: '' },
  location:   { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt:  { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model('Session', sessionSchema);
