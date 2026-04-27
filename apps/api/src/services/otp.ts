import { createHash, createHmac, randomInt, randomBytes } from 'node:crypto';
import type { DB } from '../db.js';

function generateCode(): string {
  // 6-digit zero-padded OTP
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export class OtpService {
  constructor(
    private readonly db: DB,
    private readonly ttlMinutes: number,
    private readonly maxAttempts: number,
    // Peppered HMAC over (email, code) — prevents an offline brute-force of
    // the 6-digit code space if the sqlite file leaks. The pepper is the
    // process-wide secret key that also encrypts per-agenda RSA keys.
    private readonly pepper: Buffer,
  ) {}

  private hashCode(email: string, code: string): string {
    return createHmac('sha256', this.pepper)
      .update(`ovote/otp/${email}/${code}`)
      .digest('hex');
  }

  issue(email: string): string {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000).toISOString();
    this.db
      .prepare(
        `INSERT INTO otps (email, code_hash, expires_at, attempts)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(email) DO UPDATE SET
           code_hash = excluded.code_hash,
           expires_at = excluded.expires_at,
           attempts = 0`,
      )
      .run(email, this.hashCode(email, code), expiresAt);
    return code;
  }

  verify(email: string, code: string): boolean {
    const row = this.db
      .prepare(`SELECT code_hash, expires_at, attempts FROM otps WHERE email = ?`)
      .get(email) as { code_hash: string; expires_at: string; attempts: number } | undefined;
    if (!row) return false;
    if (row.attempts >= this.maxAttempts) {
      this.db.prepare(`DELETE FROM otps WHERE email = ?`).run(email);
      return false;
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.db.prepare(`DELETE FROM otps WHERE email = ?`).run(email);
      return false;
    }
    const ok = timingSafeEqual(row.code_hash, this.hashCode(email, code));
    if (!ok) {
      this.db.prepare(`UPDATE otps SET attempts = attempts + 1 WHERE email = ?`).run(email);
      return false;
    }
    this.db.prepare(`DELETE FROM otps WHERE email = ?`).run(email);
    return true;
  }

  // Bulk-purge expired OTP rows. verify() also evicts on touch, but rows for
  // emails that never come back to verify accumulate forever — this is the
  // background sweep. Returns the number of rows removed.
  sweepExpired(now: number = Date.now()): number {
    const res = this.db
      .prepare(`DELETE FROM otps WHERE expires_at <= ?`)
      .run(new Date(now).toISOString());
    return res.changes;
  }
}

export class SessionService {
  constructor(
    private readonly db: DB,
    private readonly ttlMinutes: number,
  ) {}

  create(voterId: string): string {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000).toISOString();
    this.db
      .prepare(`INSERT INTO sessions (token_hash, voter_id, expires_at) VALUES (?, ?, ?)`)
      .run(tokenHash, voterId, expiresAt);
    return token;
  }

  resolve(token: string): string | null {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = this.db
      .prepare(`SELECT voter_id, expires_at FROM sessions WHERE token_hash = ?`)
      .get(tokenHash) as { voter_id: string; expires_at: string } | undefined;
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
      return null;
    }
    return row.voter_id;
  }

  revoke(token: string): void {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
  }

  // Same idea as OtpService.sweepExpired — resolve() evicts on touch but
  // never-touched stale sessions otherwise pile up in sqlite.
  sweepExpired(now: number = Date.now()): number {
    const res = this.db
      .prepare(`DELETE FROM sessions WHERE expires_at <= ?`)
      .run(new Date(now).toISOString());
    return res.changes;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
