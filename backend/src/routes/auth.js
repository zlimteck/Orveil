const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const InvalidToken = require('../models/InvalidToken');
const { signToken, SECRET } = require('../middleware/auth');
const { cookieOptions, clearCookieOptions } = require('../utils/cookieOptions');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const ok = await user.verifyPassword(password);
  if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = signToken({ id: user._id, username: user.username });
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
      const payload = jwt.decode(rawToken);
      if (payload?.jti && payload?.exp) {
        await InvalidToken.create({ jti: payload.jti, expiresAt: new Date(payload.exp * 1000) });
      }
    } catch {}
  }
  res.clearCookie('nh_token', clearCookieOptions);
  res.json({ ok: true });
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
    if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

module.exports = router;
