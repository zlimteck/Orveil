// Secret used to sign MCP OAuth access tokens (JWT), kept separate from
// JWT_SECRET (web session cookies) and ENCRYPTION_KEY (config at rest).
// MCP_OAUTH_JWT_SECRET env var takes precedence (useful for multi-instance
// deployments sharing one DB); otherwise falls back to a value generated once
// and persisted in Settings, same pattern as mcpApiKey.
let cached = null;

async function getOAuthJwtSecret() {
  if (process.env.MCP_OAUTH_JWT_SECRET) return process.env.MCP_OAUTH_JWT_SECRET;
  if (cached) return cached;
  const Settings = require('../models/Settings');
  const s = await Settings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, new: true },
  );
  cached = s.mcpOauthJwtSecret;
  return cached;
}

module.exports = { getOAuthJwtSecret };
