const Monitor = require('../../models/Monitor');
const Changelog = require('../../models/Changelog');

// POST /api/webhook/changelog
// Standard CI/CD webhook — token in body or header, version required
async function handleChangelog(req, res) {
  try {
    const headerToken = req.headers['token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    const body = req.body || {};
    const token = body.token || headerToken;

    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const monitor = await Monitor.findOne({ webhookToken: token }).lean();
    if (!monitor) return res.status(401).json({ error: 'Token invalide' });

    const { version, description, deployedAt } = body;
    if (!version) return res.status(400).json({ error: 'version requis' });

    const entry = await Changelog.create({
      monitorId: monitor._id,
      version,
      description: description || '',
      deployedAt: deployedAt ? new Date(deployedAt) : new Date(),
    });

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { handleChangelog };
