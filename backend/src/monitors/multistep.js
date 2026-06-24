'use strict';
const axios = require('axios');
const i18n  = require('../i18n');

function resolveVars(template, vars) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function resolveHeaders(raw, vars) {
  const obj = parseJson(raw, {});
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[resolveVars(k, vars)] = resolveVars(String(v), vars);
  }
  return out;
}

function parseJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function jsonExtract(data, path) {
  // Supports: $.field, $.nested.field, $.array[0].field
  const parts = path.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean);
  let cur = data;
  for (const part of parts) {
    if (cur == null) return null;
    cur = cur[part];
  }
  return cur ?? null;
}

function extractVars(body, headers, extractSpec) {
  const spec = parseJson(extractSpec, {});
  const out = {};
  for (const [varName, path] of Object.entries(spec)) {
    if (path.startsWith('header:')) {
      const headerKey = path.slice(7).toLowerCase();
      out[varName] = headers[headerKey] ?? null;
    } else {
      const val = jsonExtract(body, path);
      if (val != null) out[varName] = String(val);
    }
  }
  return out;
}

async function check(config, lastState, lang = 'fr') {
  const L   = i18n[lang] || i18n.fr;
  const steps = config.steps || [];

  if (!steps.length) {
    return {
      status: 'error', lastError: 'No steps configured', state: null, metrics: null,
      notifications: [{ ...L.missingConfig('Multi-step', 'At least one step required'), level: 'error', type: 'status_change' }],
    };
  }

  const vars    = {};
  const durations = [];
  let failedStep  = null;

  const totalStart = Date.now();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const url  = resolveVars(step.url || '', vars);
    const method  = (step.method || 'GET').toUpperCase();
    const headers = resolveHeaders(step.headers || '', vars);
    const rawBody = step.body ? resolveVars(step.body, vars) : undefined;
    const expectedStatus = Number(step.expectedStatus ?? 200);
    const timeout = 10000;

    // Auto content-type for JSON bodies
    if (rawBody && !headers['content-type'] && !headers['Content-Type']) {
      try { JSON.parse(rawBody); headers['Content-Type'] = 'application/json'; } catch {}
    }

    const stepStart = Date.now();
    try {
      const resp = await axios({
        method, url, headers,
        data: rawBody || undefined,
        timeout,
        validateStatus: () => true,
        maxRedirects: 5,
      });

      durations.push(Date.now() - stepStart);

      if (resp.status !== expectedStatus) {
        failedStep = {
          index: i,
          name: step.name || `Step ${i + 1}`,
          status: resp.status,
          error: `Expected ${expectedStatus}, got ${resp.status}`,
          network: false,
        };
        break;
      }

      // Extract variables from this step's response
      const extracted = extractVars(resp.data, resp.headers, step.extract || '');
      Object.assign(vars, extracted);

    } catch (err) {
      durations.push(Date.now() - stepStart);
      failedStep = {
        index: i,
        name: step.name || `Step ${i + 1}`,
        status: null,
        error: err.message,
        network: true,
      };
      break;
    }
  }

  const totalDuration = Date.now() - totalStart;
  const stepsPassed   = failedStep ? failedStep.index : steps.length;
  const status        = failedStep
    ? (failedStep.network ? 'offline' : 'error')
    : 'online';

  const metrics = {
    stepsTotal: steps.length,
    stepsPassed,
    failedStep: failedStep || null,
    totalDuration,
    stepDurations: durations,
    firstUrl: steps[0]?.url || '',
  };

  const state = { ok: !failedStep, failedStepIndex: failedStep?.index ?? null };

  const wasOk = lastState?.ok !== false;
  const isOk  = !failedStep;
  const notifications = [];

  if (!isOk && wasOk) {
    notifications.push({
      ...L.multistepFailed(failedStep.name, failedStep.index + 1, steps.length, failedStep.error),
      level: 'error', type: 'status_change',
    });
  } else if (isOk && !wasOk) {
    notifications.push({
      ...L.multistepBack(steps.length, totalDuration),
      level: 'success', type: 'status_change',
    });
  }

  return {
    status,
    lastError: failedStep ? `"${failedStep.name}": ${failedStep.error}` : null,
    state,
    metrics,
    notifications,
  };
}

module.exports = { check };
