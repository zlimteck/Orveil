const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Session = require('../models/Session');
const { authMiddleware, signToken } = require('../middleware/auth');
const { cookieOptions } = require('../utils/cookieOptions');
const { encrypt } = require('../utils/crypto');
const { resolveLocation } = require('../utils/geoip');

const passkeyLimiter      = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const passkeyWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

function getRp(req) {
  const url = new URL(process.env.FRONTEND_URL || 'http://localhost:3050');
  // Use the actual request Origin header so Docker port-mapping is transparent.
  // The Origin is embedded in clientDataJSON signed by the authenticator — it cannot be forged.
  // rpID (hostname) still provides the domain-level binding.
  const origin = req?.headers?.origin || url.origin;
  return { rpName: 'Orveil', rpID: url.hostname, origin };
}

function getIp(req) {
  return ((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '').replace(/^::ffff:/, '');
}

// GET /api/auth/passkey/register-options (auth requise)
router.get('/register-options', passkeyWriteLimiter, authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { rpName, rpID } = getRp(req);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user._id.toString(),
    userName: user.username,
    attestationType: 'none',
    excludeCredentials: (user.passkeys || []).map(pk => ({ id: pk.credentialID, type: 'public-key' })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  const challengeId = crypto.randomUUID();
  await Challenge.create({
    challengeId,
    challenge: options.challenge,
    username: user.username,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  res.json({ challengeId, options });
});

// POST /api/auth/passkey/register (auth requise)
router.post('/register', passkeyWriteLimiter, authMiddleware, async (req, res) => {
  const { challengeId, credential, name } = req.body;
  if (!challengeId || !credential) return res.status(400).json({ error: 'Champs requis' });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const stored = await Challenge.findOneAndDelete({ challengeId, username: user.username });
  if (!stored) return res.status(400).json({ error: 'Challenge expiré ou invalide' });

  const { rpID, origin } = getRp(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!verification.verified) return res.status(400).json({ error: 'Vérification échouée' });

  const { registrationInfo } = verification;
  const newPasskey = {
    credentialID: Buffer.from(registrationInfo.credentialID).toString('base64url'),
    publicKey:    Buffer.from(registrationInfo.credentialPublicKey).toString('base64url'),
    counter:      registrationInfo.counter,
    deviceType:   registrationInfo.credentialDeviceType || '',
    name:         (name || 'Passkey').substring(0, 64),
  };

  if (!user.passkeys) user.passkeys = [];
  if (user.passkeys.length >= 10) return res.status(400).json({ error: 'Maximum 10 passkeys atteint' });
  user.passkeys.push(newPasskey);
  await user.save();

  res.json({ ok: true, passkey: { ...newPasskey, _id: user.passkeys[user.passkeys.length - 1]._id } });
});

// GET /api/auth/passkey/login-options (public)
router.get('/login-options', passkeyLimiter, async (req, res) => {
  const { rpID } = getRp(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  const challengeId = crypto.randomUUID();
  await Challenge.create({
    challengeId,
    challenge: options.challenge,
    username: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  res.json({ challengeId, options });
});

// POST /api/auth/passkey/login (public)
router.post('/login', passkeyLimiter, async (req, res) => {
  const { challengeId, credential } = req.body;
  if (!challengeId || !credential) return res.status(400).json({ error: 'Champs requis' });

  const stored = await Challenge.findOneAndDelete({ challengeId, username: null });
  if (!stored) return res.status(400).json({ error: 'Challenge expiré' });

  const user = await User.findOne({ 'passkeys.credentialID': credential.id });
  if (!user) return res.status(401).json({ error: 'Passkey non reconnue' });

  const passkey = (user.passkeys || []).find(pk => pk.credentialID === credential.id);
  if (!passkey) return res.status(401).json({ error: 'Passkey non reconnue' });
  const { rpID, origin } = getRp(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      authenticator: {
        credentialID:        Buffer.from(passkey.credentialID, 'base64url'),
        credentialPublicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter:             passkey.counter,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }

  if (!verification.verified) return res.status(401).json({ error: 'Vérification échouée' });

  passkey.counter = verification.authenticationInfo.newCounter;
  await user.save();
  // Note: passkey est un facteur fort hardware-bound (phishing-resistant).
  // Par choix de design, il bypass le TOTP — équivalent à un 2FA matériel.

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

// GET /api/auth/passkey/list (auth requise)
router.get('/list', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json((user.passkeys || []).map(pk => ({
    _id: pk._id,
    credentialID: pk.credentialID,
    name: pk.name,
    deviceType: pk.deviceType,
    createdAt: pk.createdAt,
  })));
});

// DELETE /api/auth/passkey/:id (auth requise)
router.delete('/:id', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const before = (user.passkeys || []).length;
  user.passkeys = (user.passkeys || []).filter(pk => pk._id.toString() !== req.params.id);
  if (user.passkeys.length === before) return res.status(404).json({ error: 'Passkey introuvable' });

  await user.save();
  res.json({ ok: true });
});

module.exports = router;
