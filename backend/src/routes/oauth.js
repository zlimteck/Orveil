'use strict';
const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getSessionUser } = require('../middleware/auth');
const OAuthClient = require('../models/OAuthClient');
const OAuthPendingAuthorization = require('../models/OAuthPendingAuthorization');
const OAuthAuthorizationCode = require('../models/OAuthAuthorizationCode');
const { sha256Hex, randomToken, AUTH_CODE_TTL_MS } = require('../mcp/oauthProvider');

const consentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function errorRedirect(redirectUri, state, error, description) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  if (description) url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return url.href;
}

router.use(consentLimiter);
router.use(require('express').json());

// GET /api/oauth/authorize-state?pending=<id>
// Backs the consent screen: tells the SPA whether the user already has a
// valid session (skip straight to consent) or needs to log in first, and
// what to display (client name + redirect_uri's domain) + the CSRF token.
router.get('/authorize-state', async (req, res) => {
  const { pending } = req.query;
  if (!pending) return res.status(400).json({ error: 'Missing pending parameter' });

  const doc = await OAuthPendingAuthorization.findById(pending).lean();
  if (!doc || doc.expiresAt < new Date()) {
    return res.status(410).json({ error: 'This authorization request has expired. Please retry from the client.' });
  }

  const client = await OAuthClient.findOne({ client_id: doc.clientId }).lean();
  if (!client) return res.status(400).json({ error: 'Unknown client' });

  const user = await getSessionUser(req);
  const redirectHost = (() => { try { return new URL(doc.redirectUri).host; } catch { return doc.redirectUri; } })();

  res.json({
    authenticated: !!user,
    pending,
    csrfToken: doc.csrfToken,
    client: { name: client.client_name || client.client_id, redirectHost },
  });
});

// POST /api/oauth/authorize-decision { pending, csrfToken, decision: 'allow'|'deny' }
// Requires an existing web session (cookie) — the SPA only shows this screen
// once authorize-state reports authenticated:true. Mints the authorization
// code on 'allow' and returns the exact redirect URL for the SPA to navigate to.
router.post('/authorize-decision', async (req, res) => {
  const { pending, csrfToken, decision } = req.body || {};
  if (!pending || !csrfToken || !['allow', 'deny'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const doc = await OAuthPendingAuthorization.findById(pending);
  if (!doc || doc.expiresAt < new Date()) {
    return res.status(410).json({ error: 'This authorization request has expired. Please retry from the client.' });
  }
  if (!timingSafeEqualStr(csrfToken, doc.csrfToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Single use regardless of outcome.
  await OAuthPendingAuthorization.deleteOne({ _id: doc._id });

  if (decision === 'deny') {
    return res.json({ redirect: errorRedirect(doc.redirectUri, doc.state, 'access_denied', 'User denied the request') });
  }

  const code = randomToken();
  await OAuthAuthorizationCode.create({
    codeHash: sha256Hex(code),
    clientId: doc.clientId,
    redirectUri: doc.redirectUri,
    codeChallenge: doc.codeChallenge,
    resource: doc.resource,
    scopes: doc.scopes,
    userId: user.id,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });

  const url = new URL(doc.redirectUri);
  url.searchParams.set('code', code);
  if (doc.state) url.searchParams.set('state', doc.state);
  res.json({ redirect: url.href });
});

module.exports = router;
