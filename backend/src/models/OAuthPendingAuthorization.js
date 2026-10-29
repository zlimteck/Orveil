const mongoose = require('mongoose');

// Holds the state of an in-progress /authorize request (RFC 6749 + PKCE) between
// the initial redirect and the user's Allow/Deny decision on the consent screen.
// Never kept in memory — the consent step can land on a different server process.
const oauthPendingAuthorizationSchema = new mongoose.Schema({
  clientId:     { type: String, required: true },
  redirectUri:  { type: String, required: true },
  codeChallenge: { type: String, required: true },
  state:        { type: String, default: null },
  resource:     { type: String, default: null },
  scopes:       { type: [String], default: [] },
  csrfToken:    { type: String, required: true },
  expiresAt:    { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('OAuthPendingAuthorization', oauthPendingAuthorizationSchema);
