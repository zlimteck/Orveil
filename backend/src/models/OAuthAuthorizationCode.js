const mongoose = require('mongoose');

// Authorization code (RFC 6749 §4.1.2) - only the SHA-256 hash is stored, the
// code itself is a one-time secret handed to the client. 60s lifetime, consumed
// on first use (deleted, not flagged, to make replay structurally impossible).
const oauthAuthorizationCodeSchema = new mongoose.Schema({
  codeHash:      { type: String, required: true, unique: true },
  clientId:      { type: String, required: true },
  redirectUri:   { type: String, required: true },
  codeChallenge: { type: String, required: true },
  resource:      { type: String, default: null },
  scopes:        { type: [String], default: [] },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt:     { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('OAuthAuthorizationCode', oauthAuthorizationCodeSchema);
