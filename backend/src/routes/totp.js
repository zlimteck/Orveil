const router = require('express').Router();
const { generateSecret, generateSync, verifySync, generateURI } = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Session = require('../models/Session');
const InvalidToken = require('../models/InvalidToken');
const { authMiddleware, signToken, SECRET } = require('../middleware/auth');
const { cookieOptions } = require('../utils/cookieOptions');
const { encrypt, decrypt } = require('../utils/crypto');
const { resolveLocation } = require('../utils/geoip');

const totpLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const totpWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

function getIp(req) {
  return ((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '').replace(/^::ffff:/, '');
}

// POST /api/auth/totp/setup — génère secret + QR (auth requise)
router.post('/setup', totpWriteLimiter, authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.totp?.enabled) return res.status(400).json({ error: 'TOTP déjà activé' });

  const secret = generateSecret();
  const otpauth = generateURI({ secret, account: user.username, issuer: 'Orveil', type: 'totp' });
  const qrDataUrl = await qrcode.toDataURL(otpauth);

  user.totp = { secret: encrypt(secret), enabled: false, backupCodes: [] };
  await user.save();

  res.json({ secret, qrDataUrl });
});

// POST /api/auth/totp/enable — vérifie code et active le TOTP
router.post('/enable', totpWriteLimiter, authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code requis' });

  const user = await User.findById(req.user.id);
  if (!user?.totp?.secret) return res.status(400).json({ error: 'Lancez le setup d\'abord' });
  if (user.totp.enabled) return res.status(400).json({ error: 'TOTP déjà activé' });

  const { valid } = verifySync({ token: String(code).replace(/\s/g, ''), secret: decrypt(user.totp.secret) });
  if (!valid) return res.status(400).json({ error: 'Code invalide' });

  const rawCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
  const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

  user.totp.enabled = true;
  user.totp.backupCodes = hashedCodes;
  await user.save();

  res.json({ ok: true, backupCodes: rawCodes });
});

// DELETE /api/auth/totp — désactive le TOTP (mot de passe requis)
router.delete('/', totpWriteLimiter, authMiddleware, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe requis' });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const ok = await user.verifyPassword(password);
  if (!ok) return res.status(400).json({ error: 'Mot de passe incorrect' });

  user.totp = { secret: null, enabled: false, backupCodes: [] };
  await user.save();
  res.json({ ok: true });
});

// GET /api/auth/totp/status — état du TOTP pour l'UI
router.get('/status', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({
    enabled: user.totp?.enabled || false,
    backupCodesRemaining: user.totp?.backupCodes?.length || 0,
  });
});

// POST /api/auth/totp/login — vérifie OTP après mot de passe (pendingToken flow)
router.post('/login', totpLimiter, async (req, res) => {
  const { pendingToken, code } = req.body;
  if (!pendingToken || !code) return res.status(400).json({ error: 'Champs requis' });

  let payload;
  try {
    payload = jwt.verify(pendingToken, SECRET);
    if (!payload.pending) return res.status(401).json({ error: 'Token invalide' });
  } catch {
    return res.status(401).json({ error: 'Token expiré ou invalide' });
  }

  // Vérifier que le pendingToken n'a pas déjà été utilisé
  if (payload.jti && await InvalidToken.exists({ jti: payload.jti })) {
    return res.status(401).json({ error: 'Token déjà utilisé' });
  }

  let user;
  try { user = await User.findById(payload.id); } catch { return res.status(401).json({ error: 'Token invalide' }); }
  if (!user?.totp?.enabled) return res.status(400).json({ error: 'TOTP non activé' });

  const normalizedCode = String(code).replace(/\s|-/g, '').toUpperCase();
  const { valid: validTotp } = verifySync({ token: normalizedCode, secret: decrypt(user.totp.secret) });

  let usedBackupIndex = -1;
  if (!validTotp) {
    for (let i = 0; i < user.totp.backupCodes.length; i++) {
      if (await bcrypt.compare(normalizedCode, user.totp.backupCodes[i])) {
        usedBackupIndex = i;
        break;
      }
    }
  }

  if (!validTotp && usedBackupIndex === -1) {
    return res.status(401).json({ error: 'Code invalide' });
  }

  if (usedBackupIndex !== -1) {
    user.totp.backupCodes.splice(usedBackupIndex, 1);
    await user.save();
  }

  // Invalider le pendingToken pour qu'il ne puisse pas être réutilisé
  if (payload.jti) {
    await InvalidToken.create({ jti: payload.jti, expiresAt: new Date(payload.exp * 1000) }).catch(() => {});
  }

  const token = signToken({ id: user._id, username: user.username });
  const decoded = jwt.decode(token);

  const ip = getIp(req);
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

module.exports = router;
