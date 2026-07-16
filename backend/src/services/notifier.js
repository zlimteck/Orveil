const axios = require('axios');
const Settings = require('../models/Settings');
const NotificationLog = require('../models/NotificationLog');

async function getSettings() {
  return Settings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, new: true }
  );
}

async function sendNotification({ title, message, level = 'info', monitorId = null, monitorName = 'Système', type = 'info', monitorAppriseUrls = [] }) {
  const settings = await getSettings();
  const globalUrls = settings.appriseUrls || [];
  const extra = Array.isArray(monitorAppriseUrls) ? monitorAppriseUrls.filter(Boolean) : [];
  const urls = [...new Set([...globalUrls, ...extra])];

  let sent = false;

  if (urls.length > 0) {
    try {
      const apiUrl = settings.appriseApiUrl || process.env.APPRISE_API_URL || 'http://apprise:8000';
      await axios.post(`${apiUrl}/notify`, {
        urls: urls.join('\n'),
        title,
        body: message,
        type: level === 'error' ? 'failure' : level === 'warning' ? 'warning' : 'info',
      }, { timeout: 10000 });
      sent = true;
    } catch (err) {
      console.error(`[Notifier] Erreur Apprise: ${err.message}`);
    }
  } else {
    console.warn('[Notifier] Aucune URL Apprise configurée');
  }

  await NotificationLog.create({ monitorId, monitorName, type, level, title, message, sent });
  return sent;
}

module.exports = { sendNotification, getSettings };
