const router = require('express').Router();
const Monitor = require('../models/Monitor');

const STATUS_COLOR = {
  online:  '#22c55e',
  offline: '#ef4444',
  error:   '#ef4444',
  warning: '#f59e0b',
  unknown: '#6b7280',
};

const STATUS_LABEL = {
  online:  'up',
  offline: 'down',
  error:   'error',
  warning: 'degraded',
  unknown: 'unknown',
};

function makeSvg(label, status) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.unknown;
  const statusText = STATUS_LABEL[status] || status;

  const labelW = Math.max(label.length * 6.5 + 10, 40);
  const statusW = Math.max(statusText.length * 6.5 + 10, 36);
  const totalW = labelW + statusW;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20">
  <title>${label}: ${statusText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${statusW}" height="20" fill="${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelW / 2}" y="14">${label}</text>
    <text x="${labelW + statusW / 2}" y="15" fill="#010101" fill-opacity=".3">${statusText}</text>
    <text x="${labelW + statusW / 2}" y="14">${statusText}</text>
  </g>
</svg>`;
}

// GET /api/badge/:id
router.get('/:id', async (req, res) => {
  try {
    const monitor = await Monitor.findById(req.params.id, 'name status enabled').lean();
    if (!monitor) {
      return res.status(404)
        .set('Content-Type', 'image/svg+xml')
        .send(makeSvg('unknown', 'unknown'));
    }

    const status = monitor.enabled ? (monitor.status || 'unknown') : 'unknown';
    const svg = makeSvg(monitor.name, status);

    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache, max-age=0',
      'Pragma': 'no-cache',
    });
    res.send(svg);
  } catch {
    res.status(500).set('Content-Type', 'image/svg+xml').send(makeSvg('error', 'unknown'));
  }
});

module.exports = router;
