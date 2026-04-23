import { BlindSignature } from '@ovote/crypto';
import type { DB } from '../db.js';

// AgendaSigner holds the registrar's per-agenda blind-signing key. One RSA
// keypair per agenda isolates credential minting, so breaching one agenda's
// key does not let an adversary forge credentials on other agendas.
export class AgendaSigner {
  constructor(
    private readonly db: DB,
    private readonly modulusLength: 2048 | 3072 | 4096,
  ) {}

  async getOrCreate(agendaId: string): Promise<{ publicSpkiB64Url: string; privateKey: CryptoKey }> {
    const row = this.db
      .prepare(
        `SELECT public_spki, private_pkcs8 FROM blind_signer_keys WHERE agenda_id = ?`,
      )
      .get(agendaId) as { public_spki: string; private_pkcs8: string } | undefined;

    if (row) {
      const privateKey = await BlindSignature.importPrivateKey(row.private_pkcs8);
      return { publicSpkiB64Url: row.public_spki, privateKey };
    }

    const kp = await BlindSignature.generateKeyPair(this.modulusLength);
    const publicSpkiB64Url = await BlindSignature.exportPublicKey(kp.publicKey);
    const privatePkcs8B64Url = await BlindSignature.exportPrivateKey(kp.privateKey);
    this.db
      .prepare(
        `INSERT INTO blind_signer_keys (agenda_id, public_spki, private_pkcs8, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(agendaId, publicSpkiB64Url, privatePkcs8B64Url, new Date().toISOString());
    return { publicSpkiB64Url, privateKey: kp.privateKey };
  }

  async getPublicKey(agendaId: string): Promise<string | null> {
    const row = this.db
      .prepare(`SELECT public_spki FROM blind_signer_keys WHERE agenda_id = ?`)
      .get(agendaId) as { public_spki: string } | undefined;
    return row?.public_spki ?? null;
  }
}
