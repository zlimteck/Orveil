let geoip;
try { geoip = require('geoip-lite'); } catch { geoip = null; }

function resolveLocation(ip) {
  if (!ip || !geoip) return '';
  // IPs privées / loopback
  if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fe80:)/i.test(ip)) {
    return 'Réseau local';
  }
  const geo = geoip.lookup(ip);
  if (!geo) return '';
  const parts = [geo.city, geo.country].filter(Boolean);
  return parts.join(', ');
}

module.exports = { resolveLocation };
