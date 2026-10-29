const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('[FATAL] JWT_SECRET env var is required. Generate one with: openssl rand -hex 32');
  process.exit(1);
}

// Verifies the nh_token cookie without ever writing to `res` — returns the
// JWT payload on success, or null (never throws). Used both by authMiddleware
// and by routes that need an optional/soft session check (e.g. MCP OAuth
// consent screen, which must redirect to login rather than 401).
async function getSessionUser(req) {
  const cookieToken = req.cookies?.nh_token;
  if (!cookieToken) return null;
  try {
    const payload = jwt.verify(cookieToken, SECRET);
    if (payload.jti) {
      const InvalidToken = require('../models/InvalidToken');
      const revoked = await InvalidToken.exists({ jti: payload.jti });
      if (revoked) return null;
      const Session = require('../models/Session');
      const now = new Date();
      Session.findOneAndUpdate(
        { jti: payload.jti, lastSeenAt: { $lt: new Date(now - 5 * 60 * 1000) } },
        { $set: { lastSeenAt: now } },
      ).catch(() => {});
    }
    return payload;
  } catch {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  // Browser sessions use httpOnly cookie (JWT)
  if (req.cookies?.nh_token) {
    const payload = await getSessionUser(req);
    if (!payload) return res.status(401).json({ error: 'Token invalide ou expiré' });
    req.user = payload;
    return next();
  }

  // API/MCP clients use Bearer header with the MCP API key
  const bearerToken = req.headers.authorization?.slice(7);
  if (bearerToken) {
    try {
      const Settings = require('../models/Settings');
      const s = await Settings.findOne({ key: 'global' }).lean();
      if (s?.mcpApiKey && bearerToken === s.mcpApiKey) {
        req.user = { username: 'api', role: 'admin' };
        return next();
      }
    } catch {}
  }

  res.status(401).json({ error: 'Non authentifié' });
}

function signToken(payload) {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, SECRET, { expiresIn: '7d' });
}

module.exports = { authMiddleware, signToken, getSessionUser, SECRET };
