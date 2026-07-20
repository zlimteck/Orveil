const { Client } = require('ssh2');
const i18n = require('../i18n');
const { ruleConfig } = require('../config/alertRules');

function sshExec(config) {
  return new Promise((resolve, reject) => {
    const { host, port = 22, username, password, privateKey, customCommand } = config;
    const systemCmd = 'uptime && free -m | grep Mem && df -h / | tail -1 && top -bn1 | grep -iE "^(%Cpu|Cpu\\(s\\))" | head -1';
    const cmd = customCommand ? `${systemCmd} && echo __CUSTOM__ && ${customCommand}` : systemCmd;
    const conn = new Client();

    const timer = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')); }, 12000);

    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }
        let out = '';
        stream.on('data', d => { out += d; });
        stream.stderr.on('data', () => {});
        stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(out); });
      });
    });

    conn.on('error', err => { clearTimeout(timer); reject(err); });

    const connCfg = { host, port: parseInt(port) || 22, username, readyTimeout: 10000 };
    if (privateKey) connCfg.privateKey = privateKey;
    else connCfg.password = password;

    conn.connect(connCfg);
  });
}

function parseOutput(out, config) {
  const metrics = {};

  let systemOut = out;
  if (config.customCommand && out.includes('__CUSTOM__')) {
    const parts = out.split('__CUSTOM__\n');
    systemOut = parts[0];
    metrics.customOutput = (parts[1] || '').trim();
    metrics.customCommand = config.customCommand;
    if (config.expectedOutput) {
      const expected = config.expectedOutput.trim().toLowerCase();
      metrics.customMatch = metrics.customOutput.toLowerCase().includes(expected);
    }
  }

  const uptimeMatch = systemOut.match(/up\s+([^,]+(?:,\s*\d+:\d+)?)/);
  if (uptimeMatch) metrics.uptime = uptimeMatch[1].trim();

  const memMatch = systemOut.match(/Mem:\s+(\d+)\s+(\d+)/);
  if (memMatch) {
    metrics.memTotal = parseInt(memMatch[1]);
    metrics.memUsed  = parseInt(memMatch[2]);
    metrics.memPct   = Math.round((metrics.memUsed / metrics.memTotal) * 100);
  }

  const dfMatch = systemOut.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)%\s+\/$/m);
  if (dfMatch) {
    metrics.diskSize = dfMatch[2];
    metrics.diskUsed = dfMatch[3];
    metrics.diskPct  = parseInt(dfMatch[5]);
  }

  const idleMatch = systemOut.match(/(\d+[\.,]\d*)\s*%?\s*id/i);
  if (idleMatch) {
    const idle = parseFloat(idleMatch[1].replace(',', '.'));
    metrics.cpuPct = Math.round((100 - idle) * 10) / 10;
  }

  return metrics;
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host } = config;
  if (!host || !config.username) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('SSH', 'Host and username required'), level: 'error', type: 'status_change' }
  ]};

  const wasOnline = lastState !== null;

  try {
    const out = await sshExec(config);
    const metrics = { host, ...parseOutput(out, config) };

    const notifications = [];
    if (!wasOnline) notifications.push({ ...L.sshConnected(host, metrics.uptime), level: 'success', type: 'status_change' });
    const cpuRule  = ruleConfig(config.alertRules, 'ssh', 'high_cpu');
    const ramRule  = ruleConfig(config.alertRules, 'ssh', 'high_ram');
    const diskRule = ruleConfig(config.alertRules, 'ssh', 'high_disk');
    const cmdRule  = ruleConfig(config.alertRules, 'ssh', 'custom_command_mismatch');

    if (cpuRule.enabled && lastState && metrics.cpuPct > cpuRule.threshold && (lastState.cpuPct ?? 0) <= cpuRule.threshold)
      notifications.push({ ...L.sshHighCpu(host, metrics.cpuPct), level: 'warning', type: 'alert' });
    if (ramRule.enabled && lastState && metrics.memPct > ramRule.threshold && (lastState.memPct ?? 0) <= ramRule.threshold)
      notifications.push({ ...L.sshHighRam(host, metrics.memPct), level: 'warning', type: 'alert' });
    if (diskRule.enabled && lastState && metrics.diskPct > diskRule.threshold && (lastState.diskPct ?? 0) <= diskRule.threshold)
      notifications.push({ ...L.sshHighDisk(host, metrics.diskPct), level: 'warning', type: 'alert' });

    // Alert if expected output doesn't match
    const wasMatching = lastState?.customMatch !== false;
    if (cmdRule.enabled && config.customCommand && config.expectedOutput && metrics.customMatch === false && wasMatching)
      notifications.push({ ...L.sshCustomMismatch(host, config.customCommand, metrics.customOutput), level: 'warning', type: 'alert' });
    if (cmdRule.enabled && config.customCommand && config.expectedOutput && metrics.customMatch === true && !wasMatching)
      notifications.push({ ...L.sshCustomMatch(host, config.customCommand), level: 'success', type: 'alert' });

    const status = (config.expectedOutput && metrics.customMatch === false) ? 'warning' : 'online';
    return { status, state: metrics, metrics, notifications };
  } catch (err) {
    const notifications = wasOnline ? [{
      ...L.sshConnectionFailed(host),
      message: err.message,
      level: 'error', type: 'status_change',
    }] : [];
    return { status: 'offline', state: null, metrics: null, notifications };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: `SSH ${config.host}`, message: 'Unreachable.' };
  return L.sshReport(state);
}

module.exports = { check, report };
