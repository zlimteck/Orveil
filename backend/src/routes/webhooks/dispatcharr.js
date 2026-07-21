const Monitor = require('../../models/Monitor');
const Changelog = require('../../models/Changelog');

const EVENT_LABELS = {
  channel_start:     'Channel Started',
  channel_stop:      'Channel Stopped',
  channel_reconnect: 'Channel Reconnected',
  channel_error:     'Channel Error',
  channel_failover:  'Channel Failover',
  stream_switch:     'Stream Switch',
  recording_start:   'Recording Started',
  recording_end:     'Recording Ended',
  epg_refresh:       'EPG Refreshed',
  m3u_refresh:       'M3U Refreshed',
  client_connect:    'Client Connected',
  client_disconnect: 'Client Disconnected',
  login_failed:      'Login Failed',
  epg_blocked:       'EPG Blocked',
  m3u_blocked:       'M3U Blocked',
  vod_start:         'VOD Started',
  vod_stop:          'VOD Stopped',
};

function buildDescription(body) {
  const parts = [];
  if (body.channel_name) parts.push(`Channel: ${body.channel_name}`);
  if (body.stream_name)  parts.push(`Stream: ${body.stream_name}`);
  if (body.client_ip)    parts.push(`Client: ${body.client_ip}`);
  return parts.join(' · ') || (body.payload ? JSON.stringify(body.payload) : '');
}

// POST /api/webhook/dispatcharr
// Authenticated by webhookToken in token header
async function handleDispatcharr(req, res) {
  try {
    const token = req.headers['token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const monitor = await Monitor.findOne({ webhookToken: token }).lean();
    if (!monitor) return res.status(401).json({ error: 'Token invalide' });

    const body = req.body || {};
    const eventName = body.event || body.event_type || null;
    const version = EVENT_LABELS[eventName] || eventName || 'event';
    const description = body.description || buildDescription(body);
    const deployedAt = body.timestamp ? new Date(body.timestamp) : new Date();

    const entry = await Changelog.create({
      monitorId: monitor._id,
      version,
      description,
      deployedAt,
    });

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { handleDispatcharr };
