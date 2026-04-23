import { Ristretto, Threshold } from '@ovote/crypto';
import { toB64Url } from '@ovote/shared';
import type { Agenda, TrusteeDecryptionShare } from '@ovote/shared';

export interface DecryptedShareForOption {
  optionId: string;
  share: TrusteeDecryptionShare;
}

// computeDecryptionShares runs the trustee's private-key operation locally.
// The secret share is hex-encoded for clipboard-friendliness and never leaves
// the browser. One decryption share is produced per agenda option; each one
// carries a Chaum-Pedersen proof that the registrar (and anyone else) can
// verify against the trustee's published pk.
export function computeDecryptionShares(
  agenda: Agenda,
  trusteeIndex: number,
  secretShareHex: string,
  aggregate: { optionId: string; c1: string; c2: string }[],
): DecryptedShareForOption[] {
  const sk = BigInt('0x' + secretShareHex.replace(/^0x/, ''));
  const keyShare = {
    index: trusteeIndex,
    sk,
    pk: Ristretto.basePointMul(sk),
  };

  // Sanity: the derived pk must match the trustee's registered pk on the
  // agenda. If it doesn't the secret share is wrong — catch that here
  // instead of letting the server reject a proof with a cryptic error.
  const registered = agenda.key.trustees.find((t) => t.index === trusteeIndex);
  if (!registered) throw new Error(`trustee ${trusteeIndex} not on this agenda`);
  const registeredPk = Ristretto.pointFromB64Url(registered.pk);
  if (!Ristretto.pointEquals(keyShare.pk, registeredPk)) {
    throw new Error('secret share does not match your registered public share');
  }

  const nowIso = new Date().toISOString();
  return aggregate.map((a) => {
    const ct = {
      c1: Ristretto.pointFromB64Url(a.c1),
      c2: Ristretto.pointFromB64Url(a.c2),
    };
    const partial = Threshold.partialDecrypt(keyShare, ct);
    const share: TrusteeDecryptionShare = {
      agendaId: agenda.id,
      optionId: a.optionId,
      trusteeIndex,
      share: toB64Url(Ristretto.pointToBytes(partial.share)),
      proof: partial.proof,
      submittedAt: nowIso,
    };
    return { optionId: a.optionId, share };
  });
}
