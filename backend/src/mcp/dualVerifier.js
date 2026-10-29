// Bridges the new OAuth access tokens with the legacy static MCP API key, so
// existing integrations keep working while new ones (Claude connectors) use
// OAuth. Shape-based dispatch: a JWT (3 dot-separated segments) is only ever
// checked against the OAuth provider; anything else falls back to the
// legacy static-key path. Implements OAuthTokenVerifier for requireBearerAuth.
const { InvalidTokenError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const { provider } = require('./oauthProvider');

function looksLikeJwt(token) {
  return token.split('.').length === 3;
}

const dualVerifier = {
  async verifyAccessToken(token) {
    if (looksLikeJwt(token)) {
      return provider.verifyAccessToken(token);
    }

    const Settings = require('../models/Settings');
    const s = await Settings.findOne({ key: 'global' }).lean();
    if (s?.mcpApiKey && token === s.mcpApiKey) {
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
