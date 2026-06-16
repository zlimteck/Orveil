const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'notifhub-secret-change-me';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

module.exports = { authMiddleware, signToken };
