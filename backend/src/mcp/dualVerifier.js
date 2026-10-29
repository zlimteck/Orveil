// Bridges the new OAuth access tokens with the legacy static MCP API key, so
// existing integrations keep working while new ones (Claude connectors) use
// OAuth. Shape-based dispatch: a JWT (3 dot-separated segments) is only ever
// checked against the OAuth provider; anything else falls back to the
// legacy static-key path. Implements OAuthTokenVerifier for requireBearerAuth.
const crypto = require('crypto');
const { InvalidTokenError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const { provider } = require('./oauthProvider');

function looksLikeJwt(token) {
  return token.split('.').length === 3;
}

// Constant-time string compare - a plain `===` leaks timing information
// proportional to the matching prefix length, in principle letting a remote
// attacker recover the key byte by byte. Pads to equal length first so
// timingSafeEqual (which requires same-length buffers) never short-circuits
// on a length mismatch alone.
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const dualVerifier = {
  async verifyAccessToken(token) {
    if (looksLikeJwt(token)) {
      return provider.verifyAccessToken(token);
    }

    const Settings = require('../models/Settings');
    const s = await Settings.findOne({ key: 'global' }).lean();
    if (s?.mcpApiKey && timingSafeEqualStr(token, s.mcpApiKey)) {
      return {
        token,
        clientId: 'legacy-static-key',
        scopes: [],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        extra: { legacy: true },
      };
    }
    throw new InvalidTokenError('Invalid token');
  },
};

module.exports = { dualVerifier };
