const axios = require('axios');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

// R2 free plan monthly caps — not exposed by the API, hardcoded per Cloudflare docs
const FREE_MONTHLY_CLASS_A = 10_000_000; // write-ish operations (PutObject, ListObjects, etc.)
const FREE_MONTHLY_CLASS_B = 1_000_000;  // read-ish operations (GetObject, HeadObject, etc.)

async function fetchBucket(token, accountId, bucketName, http) {
  const res = await http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.result;
}

async function fetchUsage(token, accountId, bucketName, http) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const query = `
    query R2Usage($accountTag: string!, $bucketName: string, $start: Time, $end: Time) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(limit: 1000, filter: { bucketName: $bucketName, datetime_geq: $start, datetime_leq: $end }) {
            sum { requests }
            dimensions { actionType }
          }
          r2StorageAdaptiveGroups(limit: 1, filter: { bucketName: $bucketName }, orderBy: [datetime_DESC]) {
            max { payloadSize objectCount uploadCount }
          }
        }
      }
    }`;
  const res = await http.post('https://api.cloudflare.com/client/v4/graphql',
    { query, variables: { accountTag: accountId, bucketName, start: start.toISOString(), end: now.toISOString() } },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const account = res.data?.data?.viewer?.accounts?.[0] || {};
  const CLASS_A = new Set(['PutObject', 'ListObjects', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPart', 'UploadPartCopy', 'PutBucket', 'LifecycleStorageTierTransition']);
  const ops = account.r2OperationsAdaptiveGroups || [];
  let classA = 0, classB = 0;
  for (const g of ops) {
    const n = g.sum?.requests || 0;
    if (CLASS_A.has(g.dimensions?.actionType)) classA += n;
    else classB += n;
  }

  const storage = account.r2StorageAdaptiveGroups?.[0]?.max || {};
  return {
    classA, classB,
    payloadSize: storage.payloadSize ?? null,
    objectCount: storage.objectCount ?? null,
  };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiToken, accountId, bucketName, planType = 'free', proxy } = config;
  if (!apiToken || !accountId || !bucketName) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Cloudflare R2', 'API Token, Account ID and Bucket Name required'), level: 'error', type: 'status_change' }
    ]};
  }

  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });

  const [bucket, usage] = await Promise.all([
    fetchBucket(apiToken, accountId, bucketName, http),
    fetchUsage(apiToken, accountId, bucketName, http),
  ]);

  const isFree = planType === 'free';
  const classAPct = isFree ? Math.round((usage.classA / FREE_MONTHLY_CLASS_A) * 1000) / 10 : null;
  const classBPct = isFree ? Math.round((usage.classB / FREE_MONTHLY_CLASS_B) * 1000) / 10 : null;

  const critical = isFree && (classAPct >= 100 || classBPct >= 100);
  const warning = isFree && !critical && (classAPct >= 90 || classBPct >= 90);
  const wasCritical = lastState?.critical === true;

  const notifications = [];
  if (lastState !== null) {
    if (critical && !wasCritical) {
      notifications.push({ ...L.r2QuotaExceeded(bucketName, classAPct, classBPct), level: 'error', type: 'alert' });
    } else if (!critical && wasCritical) {
      notifications.push({ ...L.r2QuotaRecovered(bucketName), level: 'success', type: 'alert' });
    }
  }

  return {
    status: critical ? 'error' : warning ? 'warning' : 'online',
    state: { critical, classA: usage.classA, classB: usage.classB },
    metrics: {
      name: bucket?.name || bucketName,
      location: bucket?.location ?? null,
      storageClass: bucket?.storageClass ?? null,
      sizeBytes: usage.payloadSize,
      objectCount: usage.objectCount,
      classA: usage.classA,
      classB: usage.classB,
      classAPct,
      classBPct,
      planType,
    },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.r2Report(state?.classA, state?.classB);
}

module.exports = { check, report };
