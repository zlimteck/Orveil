#!/usr/bin/env node
// Standalone smoke test for the MCP OAuth 2.1 flow (RFC 8414/9728/7591/7009 + PKCE).
// No test framework, no new dependency - the project has none yet. Exercises
// every scenario required for the feature against a *running* Orveil backend
// pointed at a disposable database (never run this against a real instance).
//
// Usage:
//   BASE_URL=http://localhost:5099 ADMIN_USERNAME=admin ADMIN_PASSWORD=... \
//     node backend/scripts/test-mcp-oauth.js
//
// Exits 0 if every check passes, 1 otherwise (prints which one failed).

const crypto = require('crypto');

const BASE = process.env.BASE_URL || 'http://localhost:5050';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD env var is required (the test account\'s password).');
  process.exit(1);
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  - ${label}`);
  } else {
    failures++;
    console.log(`FAIL  - ${label}${detail ? ` (${JSON.stringify(detail)})` : ''}`);
  }
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main() {
  console.log(`Testing MCP OAuth against ${BASE}\n`);

  // --- 1. Discovery -------------------------------------------------------
  const prm = await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`).then(r => r.json());
  check('protected resource metadata exposes resource + authorization_servers',
    prm.resource?.endsWith('/api/mcp') && Array.isArray(prm.authorization_servers), prm);

  const asMeta = await fetch(`${BASE}/.well-known/oauth-authorization-server`).then(r => r.json());
  check('authorization server metadata has the required endpoints',
    asMeta.authorization_endpoint && asMeta.token_endpoint && asMeta.registration_endpoint
    && asMeta.code_challenge_methods_supported?.includes('S256')
    && !asMeta.code_challenge_methods_supported?.includes('plain'), asMeta);

  const mcpNoAuth = await fetch(`${BASE}/api/mcp`, { method: 'POST' });
  check('/api/mcp without token -> 401 with WWW-Authenticate resource_metadata',
    mcpNoAuth.status === 401 && mcpNoAuth.headers.get('www-authenticate')?.includes('resource_metadata='));

  // --- 2. Dynamic client registration -------------------------------------
  const client = await fetch(`${BASE}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
      client_name: 'MCP OAuth smoke test',
    }),
  }).then(r => r.json());
  check('register accepts an HTTPS redirect_uri', !!client.client_id, client);

  const regRejected = await fetch(`${BASE}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uris: ['http://not-localhost.example.com/cb'], token_endpoint_auth_method: 'none' }),
  });
  check('register rejects a non-HTTPS, non-localhost redirect_uri', regRejected.status === 400);

  // --- 3. Authorize + PKCE -------------------------------------------------
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const authUrl = new URL(`${BASE}/authorize`);
  authUrl.searchParams.set('client_id', client.client_id);
  authUrl.searchParams.set('redirect_uri', client.redirect_uris[0]);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', 'smoke-test-state');
  authUrl.searchParams.set('resource', `${BASE}/api/mcp`);

  const authRes = await fetch(authUrl, { redirect: 'manual' });
  const pendingUrl = new URL(authRes.headers.get('location') || '', BASE);
  const pending = pendingUrl.searchParams.get('pending');
  check('/authorize redirects to the consent UI with a pending id', authRes.status === 302 && !!pending);

  const plainUrl = new URL(authUrl); plainUrl.searchParams.set('code_challenge_method', 'plain');
  const plainRes = await fetch(plainUrl, { redirect: 'manual' });
  const plainLoc = plainRes.headers.get('location') || '';
  check('PKCE "plain" is rejected (error redirect, not a pending consent)',
    plainRes.status === 302 && plainLoc.includes('error=invalid_request'));

  const badRedirectUrl = new URL(authUrl); badRedirectUrl.searchParams.set('redirect_uri', 'https://not-registered.example.com/cb');
  const badRedirectRes = await fetch(badRedirectUrl, { redirect: 'manual' });
  check('unregistered redirect_uri is rejected', badRedirectRes.status === 400);

  // --- 4. Login + consent --------------------------------------------------
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  check('login succeeds and sets the session cookie', loginRes.status === 200 && !!cookie);

  const stateAnon = await fetch(`${BASE}/api/oauth/authorize-state?pending=${pending}`).then(r => r.json());
  check('authorize-state reports authenticated:false without a session', stateAnon.authenticated === false);
  check('authorize-state never leaks the CSRF token to an unauthenticated caller', stateAnon.csrfToken === undefined);

  const state = await fetch(`${BASE}/api/oauth/authorize-state?pending=${pending}`, { headers: { Cookie: cookie } }).then(r => r.json());
  check('authorize-state reports authenticated:true and returns a CSRF token', state.authenticated === true && !!state.csrfToken);

  const malformedPending = await fetch(`${BASE}/api/oauth/authorize-state?pending=not-a-valid-objectid`);
  check('a malformed pending id is rejected cleanly (not a process crash)', malformedPending.status === 410);
  const stillAlive = await fetch(`${BASE}/api/health`);
  check('the server survived the malformed pending id request', stillAlive.status === 200);

  const badCsrf = await fetch(`${BASE}/api/oauth/authorize-decision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ pending, csrfToken: 'not-the-right-token-not-the-right', decision: 'allow' }),
  });
  check('a wrong CSRF token is rejected', badCsrf.status === 403);

  const decision = await fetch(`${BASE}/api/oauth/authorize-decision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ pending, csrfToken: state.csrfToken, decision: 'allow' }),
  }).then(r => r.json());
  const redirectUrl = decision.redirect ? new URL(decision.redirect) : null;
  const code = redirectUrl?.searchParams.get('code');
  check('allow returns a redirect with code + the original state', !!code && redirectUrl.searchParams.get('state') === 'smoke-test-state');

  const pendingReused = await fetch(`${BASE}/api/oauth/authorize-state?pending=${pending}`);
  check('the pending authorization cannot be reused (410 once consumed)', pendingReused.status === 410);

  // --- 5. Token exchange -----------------------------------------------------
  const tokens = await fetch(`${BASE}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, code_verifier: verifier,
      redirect_uri: client.redirect_uris[0], client_id: client.client_id, resource: `${BASE}/api/mcp`,
    }),
  }).then(r => r.json());
  check('authorization_code exchange returns an access + refresh token', !!tokens.access_token && !!tokens.refresh_token);

  const codeReuse = await fetch(`${BASE}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id }),
  });
  check('reusing the same authorization code is rejected', codeReuse.status === 400);

  // --- 6. /api/mcp with the issued token, and legacy fallback ----------------
  const mcpOk = await fetch(`${BASE}/api/mcp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  check('/api/mcp accepts the OAuth access token', mcpOk.status === 200);

  const mcpGarbage = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { Authorization: 'Bearer not-a-jwt-and-not-the-legacy-key' } });
  check('/api/mcp rejects an invalid token with 401 + WWW-Authenticate',
    mcpGarbage.status === 401 && mcpGarbage.headers.get('www-authenticate')?.includes('resource_metadata='));

  // --- 7. Refresh rotation + replay detection ---------------------------------
  const refreshed = await fetch(`${BASE}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id }),
  }).then(r => r.json());
  check('refresh issues a new, different refresh token (rotation)',
    !!refreshed.refresh_token && refreshed.refresh_token !== tokens.refresh_token);

  const oldReused = await fetch(`${BASE}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id }),
  });
  check('reusing the rotated-out (old) refresh token is rejected', oldReused.status === 400);

  const familyDead = await fetch(`${BASE}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshed.refresh_token, client_id: client.client_id }),
  });
  check('replay revokes the whole chain - the newer token is dead too', familyDead.status === 400);

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error('FATAL', err); process.exit(1); });
