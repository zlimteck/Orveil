const axios = require('axios');
const https = require('https');
const tls = require('tls');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

function extractFavicon(html, base) {
  if (!html || typeof html !== 'string') return null;
  const m = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i)
          || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return null; }
}

function checkSSLCert(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.valid_to) return resolve(null);
      const expiresAt = new Date(cert.valid_to);
      const daysLeft = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
      const issuer = cert.issuer?.O || cert.issuer?.CN || null;
      resolve({ expiresAt: expiresAt.toISOString(), daysLeft, issuer });
    });
    socket.on('error', () => { socket.destroy(); resolve(null); });
    socket.setTimeout(5000, () => { socket.destroy(); resolve(null); });
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const {
    url, method = 'GET', body,
    expectedStatus = 200, keyword, keywordMode = 'present', acceptedStatusCodes = '',
    timeout = 10000, rejectUnauthorized = true,
    bearerToken, basicUser, basicPass, customHeaderName, customHeaderValue,
    sslAlertDays = 30, responseTimeThreshold = 0, proxy,
  } = config;

  const proxyAgents = getProxyAgents(proxy);

  // Parse accepted status codes — "200,201,302" → [200, 201, 302]
  const acceptedCodes = acceptedStatusCodes
    ? String(acceptedStatusCodes).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    : [];

  if (!url) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('HTTP', 'URL required'), level: 'error', type: 'status_change' }
  ]};

  const start = Date.now();
  let statusCode = null;
  let responseTime = null;
  let ok = false;
  let errMsg = null;

  const headers = { ...cfHeaders(config) };
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  } else if (basicUser || basicPass) {
    headers['Authorization'] = `Basic ${Buffer.from(`${basicUser || ''}:${basicPass || ''}`).toString('base64')}`;
  }
  if (customHeaderName && customHeaderValue) {
    headers[customHeaderName] = customHeaderValue;
  }

  let faviconUrl = null;
  let sslInfo = null;

  // SSL check for HTTPS URLs
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {}
  if (parsedUrl?.protocol === 'https:') {
    const port = parsedUrl.port ? parseInt(parsedUrl.port) : 443;
    sslInfo = await checkSSLCert(parsedUrl.hostname, port);
  }

  try {
    const httpMethod = (method || 'GET').toLowerCase();
    const hasBody = ['post', 'put', 'patch'].includes(httpMethod) && body;
    let parsedBody;
    if (hasBody) {
      try { parsedBody = JSON.parse(body); headers['Content-Type'] = 'application/json'; }
      catch { parsedBody = body; headers['Content-Type'] = 'text/plain'; }
    }

    const res = await axios({
      method: httpMethod,
      url,
      data: parsedBody,
      timeout,
      validateStatus: () => true,
      httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
      ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
      maxRedirects: 5,
      headers,
    });
    responseTime = Date.now() - start;
    statusCode = res.status;
    const resBody = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const statusOk = acceptedCodes.length ? acceptedCodes.includes(res.status) : res.status === expectedStatus;
    const keywordFound = keyword ? resBody.includes(keyword) : null;
    const keywordOk = keyword
      ? (keywordMode === 'absent' ? !keywordFound : keywordFound)
      : true;
    ok = statusOk && keywordOk;
    if (!statusOk) errMsg = acceptedCodes.length
      ? `Status ${res.status} (expected: ${acceptedCodes.join(', ')})`
      : `Status ${res.status} (expected ${expectedStatus})`;
    else if (!keywordOk) errMsg = keywordMode === 'absent'
      ? `Keyword "${keyword}" found in response`
      : `Keyword "${keyword}" not found in response`;

    // Extract favicon — try current response first, fall back to site root
    if (httpMethod === 'get') {
      faviconUrl = extractFavicon(resBody, url);
      if (!faviconUrl) {
        const origin = parsedUrl?.origin;
        if (origin && origin + '/' !== url && origin !== url) {
          try {
            const rootRes = await axios.get(origin, {
              timeout: 5000,
              validateStatus: () => true,
              httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
              ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
              maxRedirects: 3,
              headers,
            });
            const rootBody = typeof rootRes.data === 'string' ? rootRes.data : '';
            faviconUrl = extractFavicon(rootBody, origin);
          } catch {}
        }
      }
    }
  } catch (err) {
    responseTime = Date.now() - start;
    errMsg = err.message;
  }

  const wasOk = lastState?.ok === true;
  const wasSlow = lastState?.slowAlerted === true;
  const isSlow = ok && responseTimeThreshold > 0 && responseTime != null && responseTime > responseTimeThreshold;
  const notifications = [];
  if (lastState !== null) {
    if (!ok && wasOk) notifications.push({ ...L.httpOffline(url, errMsg), level: 'error', type: 'status_change' });
    if (ok && !wasOk) notifications.push({ ...L.httpBack(url, responseTime), level: 'success', type: 'status_change' });

    if (isSlow && !wasSlow) notifications.push({ ...L.httpSlow(url, responseTime, responseTimeThreshold), level: 'warning', type: 'response_time' });
    if (!isSlow && wasSlow) notifications.push({ ...L.httpNormalized(url, responseTime), level: 'success', type: 'response_time' });

    if (sslInfo) {
      const prevDays = lastState?.sslDaysLeft;
      if (sslInfo.daysLeft <= 0 && (prevDays === undefined || prevDays > 0)) {
        notifications.push({ ...L.httpSslExpired(parsedUrl?.hostname), level: 'error', type: 'ssl_expiry' });
      } else if (sslInfo.daysLeft <= sslAlertDays && (prevDays === undefined || prevDays > sslAlertDays)) {
        notifications.push({ ...L.httpSslExpiringSoon(parsedUrl?.hostname, sslInfo.daysLeft), level: 'warning', type: 'ssl_expiry' });
      }
    }
  }

  const sslStatus = sslInfo
    ? (sslInfo.daysLeft <= 0 ? 'expired' : sslInfo.daysLeft <= sslAlertDays ? 'expiring' : 'ok')
    : null;

  let lastError = null;
  if (!ok) lastError = errMsg || 'Service unreachable';
  else if (isSlow) lastError = `High response time: ${responseTime}ms (threshold: ${responseTimeThreshold}ms)`;
  else if (sslStatus === 'expired') lastError = 'SSL certificate expired';

  return {
    status: ok ? (isSlow || sslStatus === 'expired' ? 'warning' : 'online') : (statusCode ? 'warning' : 'offline'),
    lastError,
    state: { ok, statusCode, responseTime, errMsg, sslDaysLeft: sslInfo?.daysLeft, slowAlerted: isSlow },
    metrics: { url, statusCode, responseTime, ok, faviconUrl, errMsg, sslInfo, sslStatus },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.httpReport(config.url, state);
}

module.exports = { check, report };
