const mongoose = require('mongoose');

// Refresh token (RFC 6749 §6) — hashed at rest. Rotated on every use: the old
// doc is kept with `usedAt` set (instead of deleted) so a replay of an
// already-rotated token can be detected and revoke the whole `familyId` chain.
// `expiresAt` is fixed at the family's original grant time (not extended on
// rotation), capping a refresh chain's total lifetime to ~30 days.
const oauthRefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  familyId:  { type: String, required: true, index: true },
  clientId:  { type: String, required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resource:  { type: String, default: null },
  scopes:    { type: [String], default: [] },
  usedAt:    { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('OAuthRefreshToken', oauthRefreshTokenSchema);
