const crypto = require('crypto');
const JSZip = require('jszip');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const Settings = require('../models/Settings');
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const NotificationLog = require('../models/NotificationLog');
const MaintenanceWindow = require('../models/MaintenanceWindow');
const Annotation = require('../models/Annotation');
const Changelog = require('../models/Changelog');
const User = require('../models/User');
const { decrypt, decryptConfig } = require('../utils/crypto');

const APP_VERSION = require('../../package.json').version;
const BACKUP_FILENAME_PREFIX = 'orveil-backup-auto-';

// Optional zip encryption (dbBackup.password) — AES-256-GCM, key derived from
// the password via scrypt. Format: magic bytes + salt + IV + authTag + ciphertext,
// prefixed so restoreBackup can tell an encrypted archive from a plain one
// without assuming which kind it received.
const ENCRYPTED_MAGIC = Buffer.from('ORVL1\0');
const SCRYPT_SALT_BYTES = 16;
const GCM_IV_BYTES = 12;

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

function encryptZipBuffer(zipBuffer, password) {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES);
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(zipBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([ENCRYPTED_MAGIC, salt, iv, authTag, ciphertext]);
}

function isEncryptedBackup(buffer) {
  return buffer.length > ENCRYPTED_MAGIC.length && buffer.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC);
}

function decryptZipBuffer(buffer, password) {
  if (!password) throw new Error('This backup is password-protected');
  let offset = ENCRYPTED_MAGIC.length;
  const salt = buffer.subarray(offset, offset += SCRYPT_SALT_BYTES);
  const iv = buffer.subarray(offset, offset += GCM_IV_BYTES);
  const authTag = buffer.subarray(offset, offset += 16);
  const ciphertext = buffer.subarray(offset);

  const key = deriveKey(password, salt);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Wrong password or corrupted archive');
  }
}

function isBackupFilename(key) {
  const base = key.split('/').pop();
  return base.startsWith(BACKUP_FILENAME_PREFIX) && (base.endsWith('.zip') || base.endsWith('.zip.enc'));
}

function normalizePrefix(prefix) {
  if (!prefix) return '';
  return `${prefix.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
}

// Monitor.config/customMetrics already hold field-level encrypted secrets (see
// utils/crypto.js) — kept as-is in the dump, useless without the server's
// ENCRYPTION_KEY, same approach as other encrypted-at-rest fields below.
const BACKUP_MODELS = [
  { name: 'monitors', model: Monitor },
  { name: 'incidents', model: Incident },
  { name: 'notificationlogs', model: NotificationLog },
  { name: 'maintenancewindows', model: MaintenanceWindow },
  { name: 'annotations', model: Annotation },
  { name: 'changelogs', model: Changelog },
  { name: 'users', model: User },
];

async function exportBackup() {
  const zip = new JSZip();
  const collections = [];

  for (const { name, model } of BACKUP_MODELS) {
    const docs = await model.find().lean();
    zip.file(`${name}.json`, JSON.stringify(docs, null, 2));
    collections.push({ name, count: docs.length });
  }

  const settings = await Settings.findOne({ key: 'global' }).lean();
  zip.file('settings.json', JSON.stringify(settings, null, 2));

  zip.file('meta.json', JSON.stringify({
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    collections,
  }, null, 2));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function getS3Config() {
  const settings = await Settings.findOne({ key: 'global' });
  const cfg = settings?.dbBackup;
  const rawS3 = cfg?.s3;
  const s3 = decryptConfig(rawS3?.toObject ? rawS3.toObject() : rawS3 || {});
  return { cfg, s3 };
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function buildClient(s3) {
  const { endpoint, region = 'auto', accessKeyId, secretAccessKey, forcePathStyle = true } = s3;
  return new S3Client({ endpoint, region, forcePathStyle, credentials: { accessKeyId, secretAccessKey } });
}

async function uploadToS3(buffer, filename, s3) {
  const client = buildClient(s3);
  const key = `${normalizePrefix(s3.prefix)}${filename}`;
  await client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: buffer }));
  return { client, key, prefix: normalizePrefix(s3.prefix) };
}

async function enforceRetention(client, bucket, prefix, retention) {
  const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const backups = (res.Contents || [])
    .filter(o => isBackupFilename(o.Key))
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  for (const old of backups.slice(Math.max(1, retention))) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: old.Key }));
  }
}

async function runBackup() {
  const { cfg, s3 } = await getS3Config();
  if (!cfg) throw new Error('Backup not configured');
  if (!s3.endpoint || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
    throw new Error('Incomplete S3 destination config');
  }

  try {
    let buffer = await exportBackup();
    const password = cfg.password ? decrypt(cfg.password) : null;
    if (password) buffer = encryptZipBuffer(buffer, password);
    const filename = `${BACKUP_FILENAME_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.zip${password ? '.enc' : ''}`;
    const { client, key, prefix } = await uploadToS3(buffer, filename, s3);

    const retention = cfg.retention > 0 ? cfg.retention : 7;
    await enforceRetention(client, s3.bucket, prefix, retention);

    await Settings.updateOne({ key: 'global' }, {
      'dbBackup.lastRunAt': new Date(),
      'dbBackup.lastStatus': 'success',
      'dbBackup.lastError': null,
    });
    return { key };
  } catch (err) {
    await Settings.updateOne({ key: 'global' }, {
      'dbBackup.lastRunAt': new Date(),
      'dbBackup.lastStatus': 'error',
      'dbBackup.lastError': err.message,
    });
    throw err;
  }
}

async function listBackups() {
  const { s3 } = await getS3Config();
  if (!s3.endpoint || !s3.bucket) return [];
  const client = buildClient(s3);
  const prefix = normalizePrefix(s3.prefix);
  const res = await client.send(new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix }));
  return (res.Contents || [])
    .filter(o => isBackupFilename(o.Key))
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .map(o => ({ key: o.Key, size: o.Size, lastModified: o.LastModified, encrypted: o.Key.endsWith('.enc') }));
}

async function deleteBackup(key) {
  const { s3 } = await getS3Config();
  if (!s3.endpoint || !s3.bucket) throw new Error('Incomplete S3 destination config');
  if (!isBackupFilename(key)) throw new Error('Invalid backup key');
  const client = buildClient(s3);
  await client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
}

/**
 * Full replace restore: purges each collection then reinserts from the dump,
 * sequentially (no multi-doc transaction — Orveil's MongoDB runs as a standalone
 * instance, not a replica set, so cross-collection atomicity isn't available).
 * A failure partway through leaves some collections restored and others not.
 */
async function restoreBackup(key, password) {
  const { s3 } = await getS3Config();
  if (!s3.endpoint || !s3.bucket) throw new Error('Incomplete S3 destination config');
  if (!isBackupFilename(key)) throw new Error('Invalid backup key');

  const client = buildClient(s3);
  const res = await client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
  const rawBuffer = await streamToBuffer(res.Body);
  const buffer = isEncryptedBackup(rawBuffer) ? decryptZipBuffer(rawBuffer, password) : rawBuffer;
  const zip = await JSZip.loadAsync(buffer);

  const metaFile = zip.file('meta.json');
  if (!metaFile) throw new Error('Invalid archive: meta.json missing');
  const meta = JSON.parse(await metaFile.async('string'));

  const restored = [];
  for (const { name, model } of BACKUP_MODELS) {
    const file = zip.file(`${name}.json`);
    if (!file) continue;
    const docs = JSON.parse(await file.async('string'));
    await model.deleteMany({});
    if (docs.length) await model.insertMany(docs, { ordered: false });
    restored.push({ name, count: docs.length });
  }

  const settingsFile = zip.file('settings.json');
  if (settingsFile) {
    const dumped = JSON.parse(await settingsFile.async('string'));
    if (dumped) {
      const { _id, __v, ...rest } = dumped;
      await Settings.replaceOne({ key: 'global' }, { ...rest, key: 'global' }, { upsert: true });
    }
  }

  return { appVersion: meta.appVersion, exportedAt: meta.exportedAt, restored };
}

function isDue(cfg, now) {
  const { frequency = 'daily', dayOfWeek = 1, hour = 3, lastRunAt } = cfg;
  const scheduled = new Date(now);
  scheduled.setUTCHours(hour, 0, 0, 0);

  if (frequency === 'weekly') {
    const diff = (now.getUTCDay() - dayOfWeek + 7) % 7;
    scheduled.setUTCDate(now.getUTCDate() - diff);
  } else if (now.getUTCHours() < hour) {
    scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  }

  if (now < scheduled) return false;
  if (now - scheduled > 15 * 60 * 1000) return false;
  const last = lastRunAt ? new Date(lastRunAt) : null;
  if (last && last >= scheduled) return false;
  return true;
}

async function checkSchedule() {
  try {
    const settings = await Settings.findOne({ key: 'global' });
    const cfg = settings?.dbBackup;
    if (!cfg?.enabled) return;
    if (!isDue(cfg.toObject ? cfg.toObject() : cfg, new Date())) return;
    console.log('[DbBackup] Démarrage du backup planifié');
    await runBackup();
    console.log('[DbBackup] Backup terminé');
  } catch (err) {
    console.error('[DbBackup] Erreur backup planifié:', err.message);
  }
}

function start() {
  setInterval(checkSchedule, 15 * 60 * 1000);
  checkSchedule();
}

module.exports = { start, runBackup, listBackups, restoreBackup, deleteBackup };
