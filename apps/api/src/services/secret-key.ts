import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function decodeB64Url(s: string): Buffer {
  return Buffer.from(s.replaceAll('-', '+').replaceAll('_', '/'), 'base64');
}

function encodeB64Url(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// resolveSecretKey returns the process-wide 32-byte key used to encrypt
// sensitive material at rest. Preference order:
//   1. OVOTE_SECRET_KEY env (base64url, 32 bytes)
//   2. sibling file <dirname(dbPath)>/secret.key (mode 0600)
//   3. generate + persist to that file, chmod 0600
// For a multi-replica deployment, provision option (1) out-of-band.
export function resolveSecretKey(env: string | undefined, dbPath: string): Buffer {
  if (env && env !== '') {
    const buf = decodeB64Url(env);
    if (buf.length !== KEY_BYTES) {
      throw new Error(`OVOTE_SECRET_KEY must be 32 bytes base64url-encoded (got ${buf.length})`);
    }
    return buf;
  }
  const keyPath = join(dirname(dbPath), 'secret.key');
  mkdirSync(dirname(keyPath), { recursive: true });
  if (existsSync(keyPath)) {
    const buf = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'base64');
    if (buf.length !== KEY_BYTES) throw new Error(`${keyPath} is corrupted (wrong length)`);
    return buf;
  }
  const buf = randomBytes(KEY_BYTES);
  writeFileSync(keyPath, buf.toString('base64'), { mode: 0o600 });
  chmodSync(keyPath, 0o600);
  return buf;
}

// AES-256-GCM encrypt. Output packs iv||ciphertext||tag and returns
// base64url so it fits cleanly in a TEXT column. The key never leaves the
// process; the envelope is self-describing enough to decrypt with just the
// key plus the blob.
export function encryptAesGcm(key: Buffer, plaintext: Buffer): string {
  if (key.length !== KEY_BYTES) throw new Error('bad key length');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return encodeB64Url(Buffer.concat([iv, ct, tag]));
}

export function decryptAesGcm(key: Buffer, envelopeB64Url: string): Buffer {
  if (key.length !== KEY_BYTES) throw new Error('bad key length');
  const blob = decodeB64Url(envelopeB64Url);
  if (blob.length < IV_BYTES + TAG_BYTES) throw new Error('envelope too short');
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ct = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
