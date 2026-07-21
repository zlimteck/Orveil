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
  if (body.channel_name)      parts.push(`Channel: ${body.channel_name}`);
  if (body.stream_name)       parts.push(`Stream: ${body.stream_name}`);
  if (body.client_ip)         parts.push(`Client: ${body.client_ip}`);
  if (body.message)           parts.push(body.message);
  if (body.source)            parts.push(`Source: ${body.source}`);
  if (body.url)               parts.push(`URL: ${body.url}`);
  // EPG/M3U refresh fields
  if (body.source_name)       parts.push(`Source: ${body.source_name}`);
  if (body.channels)          parts.push(`Channels: ${body.channels}`);
  if (body.programs)          parts.push(`Programs: ${body.programs}`);
  if (body.skipped_programs)  parts.push(`Skipped: ${body.skipped_programs}`);
  if (body.unmapped_channels) parts.push(`Unmapped: ${body.unmapped_channels}`);
  if (parts.length) return parts.join(' · ');
  if (body.payload && typeof body.payload === 'object') return JSON.stringify(body.payload);
  return '';
}

// POST /api/webhook/dispatcharr
// Authenticated by webhookToken in token header
async function handleDispatcharr(req, res) {
  try {
    const token = req.headers['token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const monitor = await Monitor.findOne({ webhookToken: token }).lean();
    if (!monitor) return res.status(401).json({ error: 'Token invalide' });

    let body = req.body || {};
    // Dispatcharr sends content-type: form-urlencoded even with JSON templates
    // If body has a single key that looks like a JSON string, parse it
    const keys = Object.keys(body);
    if (keys.length === 1 && keys[0].trimStart().startsWith('{')) {
      try { body = JSON.parse(keys[0]); } catch (_) {}
    }
    const eventName = body.event || body.event_type || null;
    const label = EVENT_LABELS[eventName] || eventName || 'Event';
    const version = label;
    const description = body.description || buildDescription(body) || label;
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
