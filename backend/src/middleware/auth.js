const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('[FATAL] JWT_SECRET env var is required. Generate one with: openssl rand -hex 32');
  process.exit(1);
}

async function authMiddleware(req, res, next) {
  // Browser sessions use httpOnly cookie (JWT)
  const cookieToken = req.cookies?.nh_token;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, SECRET);
      if (payload.jti) {
        const InvalidToken = require('../models/InvalidToken');
        const revoked = await InvalidToken.exists({ jti: payload.jti });
        if (revoked) return res.status(401).json({ error: 'Token révoqué' });
      }
      if (payload.jti) {
        const Session = require('../models/Session');
        const now = new Date();
        Session.findOneAndUpdate(
          { jti: payload.jti, lastSeenAt: { $lt: new Date(now - 5 * 60 * 1000) } },
          { $set: { lastSeenAt: now } },
        ).catch(() => {});
      }
      req.user = payload;
      return next();
    } catch {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
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

module.exports = { authMiddleware, signToken, SECRET };
