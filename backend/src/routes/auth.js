const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const InvalidToken = require('../models/InvalidToken');
const Session = require('../models/Session');
const { signToken, SECRET } = require('../middleware/auth');
const { cookieOptions, clearCookieOptions } = require('../utils/cookieOptions');
const { encrypt, decrypt } = require('../utils/crypto');
const { resolveLocation } = require('../utils/geoip');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

async function verifyToken(req) {
  const token = req.cookies?.nh_token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.jti && await InvalidToken.exists({ jti: payload.jti })) return null;
    return payload;
  } catch { return null; }
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const ok = await user.verifyPassword(password);
  if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });

  // TOTP requis — token temporaire 5 min, non httpOnly
  if (user.totp?.enabled) {
    const pendingToken = jwt.sign({ id: user._id, username: user.username, pending: true, jti: crypto.randomUUID() }, SECRET, { expiresIn: '5m' });
    return res.json({ requiresOtp: true, pendingToken });
  }

  const rawIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
  const ip = rawIp.replace(/^::ffff:/, '');
  const token = signToken({ id: user._id, username: user.username });
  const decoded = jwt.decode(token);

  Session.create({
    jti: decoded.jti,
    username: user.username,
    userAgent: (req.headers['user-agent'] || '').substring(0, 512),
    ip: encrypt(ip),
    location: resolveLocation(ip),
    expiresAt: new Date(decoded.exp * 1000),
  }).catch(() => {});

  res.cookie('nh_token', token, cookieOptions);
  res.json({ username: user.username });
});

// GET /api/auth/session — always 200, user: null when not logged in
router.get('/session', async (req, res) => {
  const token = req.cookies?.nh_token;
  if (!token) return res.json({ user: null });
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.jti) {
      const revoked = await InvalidToken.exists({ jti: payload.jti });
      if (revoked) return res.json({ user: null });
    }
    res.json({ user: { username: payload.username } });
  } catch {
    res.json({ user: null });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.cookies?.nh_token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.jti) {
      const revoked = await InvalidToken.exists({ jti: payload.jti });
      if (revoked) return res.status(401).json({ error: 'Token révoqué' });
    }
    res.json({ username: payload.username });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.nh_token || req.headers.authorization?.slice(7);
  if (rawToken) {
    try {
      const payload = jwt.verify(rawToken, SECRET);
      if (payload?.jti && payload?.exp) {
        await InvalidToken.create({ jti: payload.jti, expiresAt: new Date(payload.exp * 1000) });
        await Session.deleteOne({ jti: payload.jti });
      }
    } catch {}
  }
  res.clearCookie('nh_token', clearCookieOptions);
  res.json({ ok: true });
});

// GET /api/auth/sessions — list active sessions for current user
router.get('/sessions', sessionLimiter, async (req, res) => {
  try {
    const payload = await verifyToken(req);
    if (!payload) return res.status(401).json({ error: 'Non authentifié' });
    const sessions = await Session.find({ username: payload.username }).sort({ lastSeenAt: -1 }).lean();
    res.json(sessions.map(s => ({ ...s, ip: undefined, isCurrent: s.jti === payload.jti })));
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// DELETE /api/auth/sessions/:jti — revoke a specific session
router.delete('/sessions/:jti', sessionLimiter, async (req, res) => {
  try {
    const payload = await verifyToken(req);
    if (!payload) return res.status(401).json({ error: 'Non authentifié' });
    if (req.params.jti === payload.jti) {
      return res.status(400).json({ error: 'Impossible de révoquer la session courante' });
    }
    const session = await Session.findOne({ jti: req.params.jti, username: payload.username });
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    await InvalidToken.create({ jti: session.jti, expiresAt: session.expiresAt }).catch(() => {});
    await Session.deleteOne({ jti: session.jti });
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// DELETE /api/auth/sessions — revoke all sessions except current
router.delete('/sessions', sessionLimiter, async (req, res) => {
  try {
    const payload = await verifyToken(req);
    if (!payload) return res.status(401).json({ error: 'Non authentifié' });
    const others = await Session.find({ username: payload.username, jti: { $ne: payload.jti } }).lean();
    await Promise.all(others.map(s =>
      InvalidToken.create({ jti: s.jti, expiresAt: s.expiresAt }).catch(() => {}),
    ));
    await Session.deleteMany({ username: payload.username, jti: { $ne: payload.jti } });
    res.json({ ok: true, count: others.length });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const token = req.cookies?.nh_token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const payload = jwt.verify(token, SECRET);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs requis' });
    if (newPassword.length < 12) return res.status(400).json({ error: 'Mot de passe trop court (12 caractères min)' });

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const ok = await user.verifyPassword(currentPassword);
    if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

    user.password = newPassword;
    await user.save();

    // Révoquer toutes les sessions sauf la courante
    if (payload.jti) {
      const others = await Session.find({ username: user.username, jti: { $ne: payload.jti } }).lean();
      await Promise.all(others.map(s =>
        InvalidToken.create({ jti: s.jti, expiresAt: s.expiresAt }).catch(() => {}),
      ));
      await Session.deleteMany({ username: user.username, jti: { $ne: payload.jti } });
    }

    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

module.exports = router;
