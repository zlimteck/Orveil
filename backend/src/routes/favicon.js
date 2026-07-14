const router = require('express').Router();
const https = require('https');
const http = require('http');
const Monitor = require('../models/Monitor');

// In-memory cache: url → { data, contentType, ts }
const cache = new Map();
const CACHE_TTL = 6 * 3600 * 1000; // 6h
const MAX_SIZE = 200 * 1024;        // 200 KB

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Orveil/1.0 favicon-proxy' },
      rejectUnauthorized: false,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchUrl(new URL(res.headers.location, url).href).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > MAX_SIZE) { req.destroy(); return reject(new Error('too large')); }
        chunks.push(c);
      });
      res.on('end', () => resolve({ data: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/x-icon' }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// GET /api/favicon?url=https://example.com/favicon.ico
// Only proxies URLs that are the origin of a registered monitor (SSRF guard)
router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'invalid url' }); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'invalid url' });

  // SSRF guard: the requested origin must match an origin of a registered monitor
  const origin = `${parsed.protocol}//${parsed.host}`;
  const monitors = await Monitor.find({}, 'url serviceUrl faviconUrl').lean();
  const allowed = monitors.some(m => {
    for (const field of [m.url, m.serviceUrl, m.faviconUrl]) {
      try { if (field && new URL(field).origin === origin) return true; } catch {}
    }
    return false;
  });
  if (!allowed) return res.status(403).json({ error: 'origin not registered' });

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=21600');
    return res.send(cached.data);
  }

  try {
    const { data, contentType } = await fetchUrl(url);
    cache.set(url, { data, contentType, ts: Date.now() });
    // Evict oldest if cache grows beyond 500 entries
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=21600');
    res.send(data);
  } catch {
    // Return a transparent 1×1 PNG — prevents browser console errors from img/fetch 404
    const TRANSPARENT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(TRANSPARENT_PNG);
  }
});

module.exports = router;
