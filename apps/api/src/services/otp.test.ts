import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type DB } from '../db.js';
import { OtpService, SessionService } from './otp.js';

describe('OtpService.sweepExpired / SessionService.sweepExpired', () => {
  let tmp: string;
  let db: DB;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ovote-otp-test-'));
    db = openDatabase(join(tmp, 'test.sqlite'));
  });

  afterEach(() => {
    db.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('removes expired OTP and session rows; leaves fresh rows alone', () => {
    const otp = new OtpService(db, 5, 5, randomBytes(32));
    const sessions = new SessionService(db, 60);

    // Two OTPs: one fresh, one we'll backdate.
    otp.issue('fresh@example.test');
    otp.issue('stale@example.test');
    db.prepare(`UPDATE otps SET expires_at = ? WHERE email = ?`)
      .run(new Date(Date.now() - 60_000).toISOString(), 'stale@example.test');

    // Sessions FK voters; seed two voter rows first.
    const insertVoter = db.prepare(
      `INSERT INTO voters (id, email, role, created_at) VALUES (?, ?, 'voter', ?)`,
    );
    insertVoter.run('voter-fresh', 'fresh@v.test', new Date().toISOString());
    insertVoter.run('voter-stale', 'stale@v.test', new Date().toISOString());

    // Two sessions: one fresh, one we'll backdate.
    sessions.create('voter-fresh');
    sessions.create('voter-stale');
    db.prepare(
      `UPDATE sessions SET expires_at = ? WHERE voter_id = ?`,
    ).run(new Date(Date.now() - 60_000).toISOString(), 'voter-stale');

    expect(otp.sweepExpired()).toBe(1);
    expect(sessions.sweepExpired()).toBe(1);

    const remainingOtp = db.prepare(`SELECT email FROM otps`).all() as { email: string }[];
    expect(remainingOtp.map((r) => r.email)).toEqual(['fresh@example.test']);

    const remainingSessions = db
      .prepare(`SELECT voter_id AS voterId FROM sessions`)
      .all() as { voterId: string }[];
    expect(remainingSessions.map((r) => r.voterId)).toEqual(['voter-fresh']);
  });
});
