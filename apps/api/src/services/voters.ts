import { randomUUID } from 'node:crypto';
import type { DB } from '../db.js';

export interface Voter {
  id: string;
  email: string;
  role: 'voter' | 'admin' | 'trustee';
}

export class VoterRegistry {
  constructor(private readonly db: DB) {}

  upsertByEmail(email: string): Voter {
    const existing = this.findByEmail(email);
    if (existing) return existing;
    const id = randomUUID();
    this.db
      .prepare(`INSERT INTO voters (id, email, role, created_at) VALUES (?, ?, 'voter', ?)`)
      .run(id, email, new Date().toISOString());
    return { id, email, role: 'voter' };
  }

  findByEmail(email: string): Voter | null {
    const row = this.db
      .prepare(`SELECT id, email, role FROM voters WHERE email = ?`)
      .get(email) as Voter | undefined;
    return row ?? null;
  }

  findById(id: string): Voter | null {
    const row = this.db
      .prepare(`SELECT id, email, role FROM voters WHERE id = ?`)
      .get(id) as Voter | undefined;
    return row ?? null;
  }

  isEligible(voterId: string, agendaId: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 AS x FROM eligibility WHERE voter_id = ? AND agenda_id = ?`)
      .get(voterId, agendaId) as { x: number } | undefined;
    return row !== undefined;
  }

  addEligibility(voterId: string, agendaId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO eligibility (voter_id, agenda_id) VALUES (?, ?)`,
      )
      .run(voterId, agendaId);
  }

  hasIssuedCredential(voterId: string, agendaId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 AS x FROM credentials_issued WHERE voter_id = ? AND agenda_id = ?`,
      )
      .get(voterId, agendaId) as { x: number } | undefined;
    return row !== undefined;
  }

  recordCredentialIssued(voterId: string, agendaId: string): void {
    this.db
      .prepare(
        `INSERT INTO credentials_issued (voter_id, agenda_id, issued_at) VALUES (?, ?, ?)`,
      )
      .run(voterId, agendaId, new Date().toISOString());
  }
}
