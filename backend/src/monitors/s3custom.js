const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const i18n = require('../i18n');

// Caps pagination so huge buckets don't stall checks — stats become an approximation above this.
const MAX_PAGES = 20;

function buildClient(config) {
  const { endpoint, region = 'auto', accessKeyId, secretAccessKey, forcePathStyle = true } = config;
  return new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function fetchBucketStats(client, bucket) {
  let objectCount = 0;
  let sizeBytes = 0;
  let truncated = true;
  let continuationToken;
  let pages = 0;

  while (truncated && pages < MAX_PAGES) {
    const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
    for (const obj of res.Contents || []) {
      objectCount += 1;
      sizeBytes += obj.Size || 0;
    }
    truncated = !!res.IsTruncated;
    continuationToken = res.NextContinuationToken;
    pages += 1;
  }

  return { objectCount, sizeBytes, approximate: truncated };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { endpoint, bucket, accessKeyId, secretAccessKey, latencyThresholdMs = 0 } = config;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('S3 Custom', 'Endpoint, Bucket, Access Key and Secret Key required'), level: 'error', type: 'status_change' }
    ]};
  }

  const client = buildClient(config);

  const start = Date.now();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  const responseTime = Date.now() - start;

  const { objectCount, sizeBytes, approximate } = await fetchBucketStats(client, bucket);

  const slow = latencyThresholdMs > 0 && responseTime > latencyThresholdMs;
  const wasSlow = lastState?.slow === true;

  const notifications = [];
  if (lastState !== null) {
    if (slow && !wasSlow) {
      notifications.push({ ...L.s3LatencyHigh(bucket, responseTime, latencyThresholdMs), level: 'warning', type: 'alert' });
    } else if (!slow && wasSlow) {
      notifications.push({ ...L.s3LatencyRecovered(bucket), level: 'success', type: 'alert' });
    }
  }

  return {
    status: slow ? 'warning' : 'online',
    statusCode: 200,
    responseTime,
    state: { slow, objectCount, sizeBytes },
    metrics: { bucket, sizeBytes, objectCount, approximate, responseTime, statusCode: 200 },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.s3Report(state?.sizeBytes, state?.objectCount);
}

module.exports = { check, report };
