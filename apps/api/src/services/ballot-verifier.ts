import { BlindSignature, Disjunctive, Ristretto } from '@ovote/crypto';
import type { Agenda, Ballot } from '@ovote/shared';
import { fromB64Url } from '@ovote/shared';

// verifyBallot re-runs every zero-knowledge proof the ballot carries so the
// registrar never relays a malformed ballot to the chain. The same logic can
// run in a voter's or auditor's browser using @ovote/crypto — this function is
// just the server-side copy.
export async function verifyBallot(agenda: Agenda, ballot: Ballot): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (ballot.agendaId !== agenda.id) return { ok: false, reason: 'agendaId mismatch' };

  const agendaOptionIds = new Set(agenda.options.map((o) => o.id));
  if (ballot.options.length !== agenda.options.length) {
    return { ok: false, reason: `ballot must cover all ${agenda.options.length} options` };
  }

  const pk = Ristretto.pointFromB64Url(agenda.key.groupPk);
  const zeroOrOne = Disjunctive.zeroOrOneMessagePoints();

  const seen = new Set<string>();
  for (const opt of ballot.options) {
    if (!agendaOptionIds.has(opt.optionId)) {
      return { ok: false, reason: `unknown option ${opt.optionId}` };
    }
    if (seen.has(opt.optionId)) {
      return { ok: false, reason: `duplicate option ${opt.optionId}` };
    }
    seen.add(opt.optionId);

    const ct = {
      c1: Ristretto.pointFromB64Url(opt.ciphertext.c1),
      c2: Ristretto.pointFromB64Url(opt.ciphertext.c2),
    };

    const proofOk = Disjunctive.verifyMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: zeroOrOne,
      proof: { parts: opt.proof },
    });
    if (!proofOk) {
      return { ok: false, reason: `disjunctive proof failed for option ${opt.optionId}` };
    }
  }

  // Verify blind-signed credential. `nonce` carries the already-prepared
  // credential token (voter ran prepare() client-side before blinding; RSABSSA
  // prepare() is randomized, so the server cannot reproduce it). Registrar's
  // public key comes from the agenda record — the chain is the single source
  // of truth for the key.
  try {
    const registrarPk = await BlindSignature.importPublicKey(agenda.registrarBlindPk);
    const preparedBytes = fromB64Url(ballot.credential.nonce);
    const sigBytes = fromB64Url(ballot.credential.signature);
    const ok = await BlindSignature.verify(registrarPk, sigBytes, preparedBytes);
    if (!ok) return { ok: false, reason: 'credential signature invalid' };
  } catch (err) {
    return { ok: false, reason: `credential verification error: ${(err as Error).message}` };
  }

  return { ok: true };
}
