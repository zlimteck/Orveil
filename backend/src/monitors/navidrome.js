const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

function subsonicAuth(username, password) {
  const salt = crypto.randomBytes(6).toString('hex');
  const token = crypto.createHash('md5').update(password + salt).digest('hex');
  return { u: username, t: token, s: salt, c: 'Orveil', f: 'json', v: '1.16.1' };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, username, password, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !username || !password) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Navidrome', 'URL, username and password required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');
  const auth = subsonicAuth(username, password);
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    params: auth,
  });

  const start = Date.now();
  try {
    const [pingRes, artistsRes, nowPlayingRes] = await Promise.all([
      http.get(`${base}/rest/ping`),
      http.get(`${base}/rest/getArtists`),
      http.get(`${base}/rest/getNowPlaying`),
    ]);
    const responseTime = Date.now() - start;

    const ping = pingRes.data?.['subsonic-response'];
    if (ping?.status !== 'ok') {
      const errMsg = ping?.error?.message || 'Authentication failed';
      return {
        status: 'offline', lastError: errMsg, state: null, metrics: null,
        notifications: [{ ...L.unreachable('Navidrome', base, errMsg), level: 'error', type: 'status_change' }],
      };
    }

    const version = ping?.version ?? null;
    const artists = artistsRes.data?.['subsonic-response']?.artists?.index ?? [];
    const artistCount = artists.reduce((sum, idx) => sum + (idx.artist?.length ?? 0), 0);

    const nowPlayingItems = nowPlayingRes.data?.['subsonic-response']?.nowPlaying?.entry ?? [];
    const nowPlaying = Array.isArray(nowPlayingItems) ? nowPlayingItems.length : 0;

    const state = { version, artistCount, nowPlaying };
    const metrics = { version, artistCount, nowPlaying, responseTime, statusCode: 200 };

    return { status: 'online', lastError: null, state, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'offline', lastError: err.message, state: null, metrics: null,
      notifications: [{ ...L.unreachable('Navidrome', base, err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Navidrome', message: 'No data.' };
  return L.navidromeReport(state);
}

module.exports = { check, report };
