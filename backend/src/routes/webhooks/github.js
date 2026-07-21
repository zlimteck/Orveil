const crypto = require('crypto');
const Monitor = require('../../models/Monitor');
const Changelog = require('../../models/Changelog');

function verifySignature(secret, payload, signature) {
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parsePayload(event, body) {
  if (event === 'release') {
    const r = body.release || {};
    return {
      version: r.tag_name || 'release',
      description: [r.name, r.body].filter(Boolean).join('\n').slice(0, 500) || '',
    };
  }

  if (event === 'push') {
    const ref = body.ref || '';
    const commits = body.commits || [];
    const headCommit = body.head_commit || commits[commits.length - 1] || {};
    const sha = (body.after || '').slice(0, 7);

    if (ref.startsWith('refs/tags/')) {
      const tag = ref.replace('refs/tags/', '');
      return {
        version: tag,
        description: headCommit.message?.split('\n')[0] || '',
      };
    }

    const branch = ref.replace('refs/heads/', '');
    return {
      version: `${branch}@${sha}`,
      description: headCommit.message?.split('\n')[0] || '',
    };
  }

  if (event === 'create' && body.ref_type === 'tag') {
    return {
      version: body.ref || 'tag',
      description: `Tag created in ${body.repository?.full_name || ''}`,
    };
  }

  return null;
}

// POST /api/webhook/github/:token
// Token is the monitor webhookToken (put it in the GitHub webhook URL)
// Optional: set a webhook secret in GitHub and store it in the URL as ?secret=xxx
async function handleGithub(req, res) {
  try {
    const { token } = req.params;
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const monitor = await Monitor.findOne({ webhookToken: token }).lean();
    if (!monitor) return res.status(401).json({ error: 'Token invalide' });

    // Optional signature verification if monitor has a webhookSecret configured
    const secret = monitor.config?.webhookSecret;
    if (secret) {
      const sig = req.headers['x-hub-signature-256'];
      const raw = JSON.stringify(req.body);
      if (!verifySignature(secret, raw, sig)) {
        return res.status(401).json({ error: 'Signature invalide' });
      }
    }

    const event = req.headers['x-github-event'];
    if (!event) return res.status(400).json({ error: 'X-GitHub-Event header manquant' });

    // Ignore non-content events
    if (['ping', 'installation', 'check_run', 'check_suite', 'status'].includes(event)) {
      return res.json({ ok: true, ignored: true });
    }

    const parsed = parsePayload(event, req.body);
    if (!parsed) return res.json({ ok: true, ignored: true, reason: `event '${event}' not mapped` });

    const repo = req.body.repository?.full_name || req.body.repository?.name || '';
    const description = [repo ? `[${repo}]` : '', parsed.description].filter(Boolean).join(' ');

    const entry = await Changelog.create({
      monitorId: monitor._id,
      version: parsed.version,
      description,
      deployedAt: new Date(),
    });

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { handleGithub };
