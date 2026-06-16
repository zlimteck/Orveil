const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');

function extractFavicon(html, base) {
  if (!html || typeof html !== 'string') return null;
  const m = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i)
          || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return null; }
}

async function check(config, lastState) {
  const {
    url, expectedStatus = 200, keyword, timeout = 10000, rejectUnauthorized = true,
    bearerToken, basicUser, basicPass, customHeaderName, customHeaderValue,
  } = config;

  if (!url) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — HTTP', message: 'URL requise', level: 'error', type: 'error' }
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

  try {
    const res = await axios.get(url, {
      timeout,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized }),
      maxRedirects: 5,
      headers,
    });
    responseTime = Date.now() - start;
    statusCode = res.status;
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const statusOk = res.status === expectedStatus;
    const keywordOk = keyword ? body.includes(keyword) : true;
    ok = statusOk && keywordOk;
    if (!statusOk) errMsg = `Status ${res.status} (attendu ${expectedStatus})`;
    else if (!keywordOk) errMsg = `Mot-clé "${keyword}" absent de la réponse`;

    // Extract favicon — try current response first, fall back to site root
    faviconUrl = extractFavicon(body, url);
    if (!faviconUrl) {
      const origin = new URL(url).origin;
      if (origin + '/' !== url && origin !== url) {
        try {
          const rootRes = await axios.get(origin, {
            timeout: 5000,
            validateStatus: () => true,
            httpsAgent: new https.Agent({ rejectUnauthorized }),
            maxRedirects: 3,
            headers,
          });
          const rootBody = typeof rootRes.data === 'string' ? rootRes.data : '';
          faviconUrl = extractFavicon(rootBody, origin);
        } catch {}
      }
    }
  } catch (err) {
    responseTime = Date.now() - start;
    errMsg = err.message;
  }

  const wasOk = lastState?.ok === true;
  const notifications = [];
  if (lastState !== null) {
    if (!ok && wasOk) notifications.push({
      title: `🔴 ${url} — Hors ligne`,
      message: errMsg || 'Service inaccessible',
      level: 'error', type: 'status_change',
    });
    if (ok && !wasOk) notifications.push({
      title: `🟢 ${url} — De retour`,
      message: `Temps de réponse : ${responseTime}ms`,
      level: 'success', type: 'status_change',
    });
  }

  return {
    status: ok ? 'online' : (statusCode ? 'warning' : 'offline'),
    state: { ok, statusCode, responseTime, errMsg },
    metrics: { url, statusCode, responseTime, ok, faviconUrl, errMsg },
    notifications,
  };
}

async function report(config, state) {
  const { url } = config;
  const msg = state?.ok
    ? `✅ ${url}\nStatut : ${state.statusCode} — ${state.responseTime}ms`
    : `❌ ${url}\n${state?.errMsg || 'Inaccessible'}`;
  return { title: `🌐 Rapport HTTP — ${url}`, message: msg };
}

module.exports = { check, report };
