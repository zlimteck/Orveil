// Self-hosted, no domain hardcoded: the public base URL comes from FRONTEND_URL
// (same env var already used for CORS/cookies/WebAuthn), falling back to the
// request's own Origin so Docker port-mapping / reverse-proxy setups stay transparent.
function getBaseUrl(req) {
  const fromEnv = (process.env.FRONTEND_URL || '').split(',')[0].trim();
  if (fromEnv) return new URL(fromEnv);
  if (req?.headers?.origin) return new URL(req.headers.origin);
  const proto = req?.protocol || 'http';
  const host = req?.get?.('host') || 'localhost:5050';
  return new URL(`${proto}://${host}`);
}

module.exports = { getBaseUrl };
