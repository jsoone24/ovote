import { BlindSignature } from '@ovote/crypto';
import type { DB } from '../db.js';
import { decryptAesGcm, encryptAesGcm } from './secret-key.js';

// AgendaSigner holds the registrar's per-agenda blind-signing key. One RSA
// keypair per agenda isolates credential minting, so breaching one agenda's
// key does not let an adversary forge credentials on other agendas.
//
// The PKCS8-encoded private key is encrypted with AES-256-GCM under the
// process-wide secret key (see secret-key.ts) before it touches the disk.
// An attacker who exfiltrates the sqlite file without the secret key gets
// nothing usable.
export class AgendaSigner {
  constructor(
    private readonly db: DB,
    private readonly modulusLength: 2048 | 3072 | 4096,
    private readonly secretKey: Buffer,
  ) {}

  async getOrCreate(agendaId: string): Promise<{ publicSpkiB64Url: string; privateKey: CryptoKey }> {
    const row = this.db
      .prepare(
        `SELECT public_spki, private_pkcs8 FROM blind_signer_keys WHERE agenda_id = ?`,
      )
      .get(agendaId) as { public_spki: string; private_pkcs8: string } | undefined;

    if (row) {
      const plaintextPkcs8B64Url = bufferToB64Url(
        decryptAesGcm(this.secretKey, row.private_pkcs8),
      );
      const privateKey = await BlindSignature.importPrivateKey(plaintextPkcs8B64Url);
      return { publicSpkiB64Url: row.public_spki, privateKey };
    }

    const kp = await BlindSignature.generateKeyPair(this.modulusLength);
    const publicSpkiB64Url = await BlindSignature.exportPublicKey(kp.publicKey);
    const plaintextPkcs8B64Url = await BlindSignature.exportPrivateKey(kp.privateKey);
    const encryptedPkcs8 = encryptAesGcm(this.secretKey, b64UrlToBuffer(plaintextPkcs8B64Url));
    this.db
      .prepare(
        `INSERT INTO blind_signer_keys (agenda_id, public_spki, private_pkcs8, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(agendaId, publicSpkiB64Url, encryptedPkcs8, new Date().toISOString());
    return { publicSpkiB64Url, privateKey: kp.privateKey };
  }

  async getPublicKey(agendaId: string): Promise<string | null> {
    const row = this.db
      .prepare(`SELECT public_spki FROM blind_signer_keys WHERE agenda_id = ?`)
      .get(agendaId) as { public_spki: string } | undefined;
    return row?.public_spki ?? null;
  }
}

function b64UrlToBuffer(s: string): Buffer {
  return Buffer.from(s.replaceAll('-', '+').replaceAll('_', '/'), 'base64');
}

function bufferToB64Url(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
