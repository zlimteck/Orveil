'use strict';
const router = require('express').Router();
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { requireBearerAuth } = require('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
const { getOAuthProtectedResourceMetadataUrl } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const { createServer } = require('../mcp/server');
const { dualVerifier } = require('../mcp/dualVerifier');
const { getBaseUrl } = require('../utils/publicUrl');

function auth(req, res, next) {
  const resourceServerUrl = new URL('/api/mcp', getBaseUrl(req));
  return requireBearerAuth({
    verifier: dualVerifier,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  })(req, res, next);
}

async function handle(req, res) {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('finish', () => server.close().catch(() => {}));
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}

router.post('/', auth, handle);
router.get('/',  auth, handle);
router.delete('/', auth, (req, res) => res.status(200).json({ ok: true }));

module.exports = router;
