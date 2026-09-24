const i18n = require('../i18n');

// Event-only monitor — no active polling, status/notifications are driven
// entirely by incoming POSTs handled in routes/webhookEvent.js.
async function check(config, lastState, lang = 'fr') {
  return {
    status: lastState?.lastEvent ? 'online' : 'unknown',
    state: lastState || {},
    metrics: { lastEvent: lastState?.lastEvent || null, lastEventAt: lastState?.lastEventAt || null },
    notifications: [],
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const last = state?.lastEventAt ? new Date(state.lastEventAt).toLocaleString() : 'never';
  return L.webhookReport(last, state?.lastEvent || '');
}

module.exports = { check, report };
