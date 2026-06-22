const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { expectedEvery = 60 } = config; // minutes

  if (!lastState?.lastPing) {
    return {
      status: 'unknown',
      state: lastState || {},
      metrics: { lastPing: null, expectedEvery },
      notifications: [],
    };
  }

  const lastPing = new Date(lastState.lastPing);
  const minutesSince = (Date.now() - lastPing.getTime()) / 60000;
  const late = minutesSince > expectedEvery * 1.5; // 50% grace period
  const status = late ? 'offline' : 'online';

  const notifications = [];
  const wasOnline = lastState?.wasOnline !== false;

  if (late && wasOnline) {
    notifications.push({ ...L.heartbeatMissed(Math.round(minutesSince), expectedEvery), level: 'error', type: 'status_change' });
  } else if (!late && !wasOnline) {
    notifications.push({ ...L.heartbeatRestored(), level: 'success', type: 'status_change' });
  }

  return {
    status,
    state: { ...lastState, wasOnline: !late },
    metrics: { lastPing: lastState.lastPing, minutesSince: Math.round(minutesSince), expectedEvery },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { expectedEvery = 60 } = config;
  const last = state?.lastPing ? new Date(state.lastPing).toLocaleString() : 'never';
  return L.heartbeatReport(last, expectedEvery);
}

module.exports = { check, report };
