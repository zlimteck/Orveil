const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidTargetError,
  InvalidTokenError,
} = require('@modelcontextprotocol/sdk/server/auth/errors.js');

const OAuthClient = require('../models/OAuthClient');
const OAuthPendingAuthorization = require('../models/OAuthPendingAuthorization');
const OAuthAuthorizationCode = require('../models/OAuthAuthorizationCode');
const OAuthRefreshToken = require('../models/OAuthRefreshToken');
const { getOAuthJwtSecret } = require('../utils/oauthSecret');
const { getBaseUrl } = require('../utils/publicUrl');

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;          // 1h
const AUTH_CODE_TTL_MS = 60 * 1000;                // 60s
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

// RFC 7591 registration store, backed by Mongo. HTTPS is mandatory for
// redirect_uris except the native-app loopback exemption (RFC 8252 §7.3).
const clientsStore = {
  async getClient(clientId) {
    const doc = await OAuthClient.findOne({ client_id: clientId }).lean();
    return doc || undefined;
  },

  async registerClient(client) {
    for (const uri of client.redirect_uris) {
      let parsed;
      try {
        parsed = new URL(uri);
      } catch {
        throw new InvalidClientMetadataError(`Invalid redirect_uri: ${uri}`);
      }
      if (parsed.protocol !== 'https:' && !isLoopback(parsed.hostname)) {
        throw new InvalidClientMetadataError('redirect_uris must use HTTPS (http://localhost is exempt)');
      }
    }
    const created = await OAuthClient.create(client);
    return created.toObject();
  },
};

async function issueAccessToken({ userId, clientId, resource, scopes }) {
  const secret = await getOAuthJwtSecret();
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_TTL_SECONDS;
  const token = jwt.sign({
    sub: String(userId),
    client_id: clientId,
    aud: resource || undefined,
    scope: (scopes || []).join(' ') || undefined,
    jti,
    iat: now,
    exp,
  }, secret, { algorithm: 'HS256' });
  return { token, expiresAt: exp };
}

function newRefreshFamily({ userId, clientId, resource, scopes, familyId }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return OAuthRefreshToken.create({
    tokenHash: sha256Hex(token),
    familyId: familyId || crypto.randomUUID(),
    clientId,
    userId,
    resource: resource || null,
    scopes: scopes || [],
    expiresAt,
  }).then(() => token);
}

const provider = {
  clientsStore,

  skipLocalPkceValidation: false,

  // Not used directly: our custom /oauth/authorize-ui + /api/oauth/authorize-decision
  // flow (same-origin consent screen reusing the existing web session) creates the
  // pending authorization and, on approval, redirects back here with ?code=&state=.
  // The SDK's authorizationHandler calls this right after validating client_id /
  // redirect_uri / PKCE shape - we just hand off to our own UI.
  async authorize(client, params, res) {
    const pending = await OAuthPendingAuthorization.create({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state || null,
      resource: params.resource ? params.resource.href : null,
      scopes: params.scopes || [],
      csrfToken: randomToken(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const base = getBaseUrl();
    const url = new URL('/oauth/authorize', base);
    url.searchParams.set('pending', String(pending._id));
    res.redirect(302, url.href);
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const doc = await OAuthAuthorizationCode.findOne({
      codeHash: sha256Hex(authorizationCode),
      clientId: client.client_id,
    }).lean();
    if (!doc) throw new InvalidGrantError('Invalid or expired authorization code');
    return doc.codeChallenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri, resource) {
    const codeHash = sha256Hex(authorizationCode);
    // Atomic delete-on-read: a concurrent second exchange of the same code
    // finds nothing and fails, making the code structurally single-use.
    const doc = await OAuthAuthorizationCode.findOneAndDelete({ codeHash, clientId: client.client_id });
    if (!doc) throw new InvalidGrantError('Invalid, expired, or already used authorization code');
    if (redirectUri && redirectUri !== doc.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match the one used in the authorization request');
    }
    if (resource && doc.resource && resource.href !== doc.resource) {
      throw new InvalidTargetError('resource does not match the authorization request');
    }

    const access = await issueAccessToken({
      userId: doc.userId, clientId: client.client_id, resource: doc.resource, scopes: doc.scopes,
    });
    const refresh_token = await newRefreshFamily({
      userId: doc.userId, clientId: client.client_id, resource: doc.resource, scopes: doc.scopes,
    });

    return {
      access_token: access.token,
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token,
      scope: (doc.scopes || []).join(' ') || undefined,
    };
  },

  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const tokenHash = sha256Hex(refreshToken);
    const doc = await OAuthRefreshToken.findOne({ tokenHash, clientId: client.client_id });
    if (!doc) throw new InvalidGrantError('Invalid refresh token');

    if (doc.usedAt || doc.expiresAt < new Date()) {
      // Replay of an already-rotated (or expired) token: revoke the whole chain.
      await OAuthRefreshToken.deleteMany({ familyId: doc.familyId });
      throw new InvalidGrantError('Refresh token has already been used - session revoked');
    }

    doc.usedAt = new Date();
    await doc.save();

    const effectiveResource = resource ? resource.href : doc.resource;
    const access = await issueAccessToken({
      userId: doc.userId, clientId: client.client_id, resource: effectiveResource, scopes: doc.scopes,
    });
    // New token in the same family, lifetime capped to the original grant
    // (not extended on rotation) - see model comment.
    const newToken = randomToken();
    await OAuthRefreshToken.create({
      tokenHash: sha256Hex(newToken),
      familyId: doc.familyId,
      clientId: client.client_id,
      userId: doc.userId,
      resource: doc.resource,
      scopes: doc.scopes,
      expiresAt: doc.expiresAt,
    });

    return {
      access_token: access.token,
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: newToken,
      scope: (doc.scopes || []).join(' ') || undefined,
    };
  },

  async verifyAccessToken(token) {
    const secret = await getOAuthJwtSecret();
    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      throw new InvalidTokenError('Invalid or expired access token');
    }
    return {
      token,
      clientId: payload.client_id,
      scopes: payload.scope ? payload.scope.split(' ') : [],
      expiresAt: payload.exp,
      resource: payload.aud ? new URL(payload.aud) : undefined,
      extra: { userId: payload.sub },
    };
  },

  async revokeToken(client, request) {
    const { token } = request;
    const hash = sha256Hex(token);
    await OAuthRefreshToken.deleteMany({ tokenHash: hash, clientId: client.client_id });
    // Access tokens are stateless JWTs: a revoke call for one only stops its
    // refresh-token family. The access token itself stays valid until `exp`
    // (documented in docs/mcp-oauth.md).
  },
};

module.exports = { provider, sha256Hex, randomToken, AUTH_CODE_TTL_MS };
