const crypto = require('crypto');

const ALGO   = 'aes-256-gcm';
const PREFIX = 'enc:';

const SENSITIVE = new Set([
  'apiKey', 'apiToken', 'token', 'password', 'privateKey',
  'hmsToken', 'ultraToken', 'cfClientId', 'cfClientSecret',
  'bearerToken', 'basicPass',
]);

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const key = getKey();
  if (!key || !plaintext) return plaintext;
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const data   = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + data.toString('hex');
}

function decrypt(ciphertext) {
  if (!ciphertext || !String(ciphertext).startsWith(PREFIX)) return ciphertext;
  const key = getKey();
  if (!key) return ciphertext;
  try {
    const [ivHex, tagHex, dataHex] = String(ciphertext).slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return ciphertext;
  }
}

function encryptConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const result = { ...config };
  for (const k of Object.keys(result)) {
    if (SENSITIVE.has(k) && result[k] && !String(result[k]).startsWith(PREFIX)) {
      result[k] = encrypt(result[k]);
    }
  }
  return result;
}

function decryptConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const result = { ...config };
  for (const k of Object.keys(result)) {
    if (SENSITIVE.has(k) && result[k] && String(result[k]).startsWith(PREFIX)) {
      result[k] = decrypt(result[k]);
    }
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptConfig, decryptConfig };
