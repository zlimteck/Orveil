const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  challengeId: { type: String, required: true, unique: true },
  challenge:   { type: String, required: true },
  username:    { type: String, default: null },
  expiresAt:   { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model('Challenge', challengeSchema);
