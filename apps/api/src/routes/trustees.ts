import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ElGamal, Ristretto, Threshold, type Point } from '@ovote/crypto';
import { parseTallyProof, parseTrusteeDecryptionShare } from '@ovote/shared';
import type { Agenda, Ballot, TallyProof, TrusteeDecryptionShare } from '@ovote/shared';
import type { ChainGateway } from '../services/chain.js';
import type { SessionService } from '../services/otp.js';
import type { VoterRegistry } from '../services/voters.js';
import { requireRole, requireSession } from '../middleware/auth.js';

const SubmitShareBody = z.object({
  share: z.unknown(),
}).strict();

const PublishResultBody = z.object({
  agendaId: z.string().uuid(),
}).strict();

export interface TrusteeDeps {
  chain: ChainGateway;
  sessions: SessionService;
  registry: VoterRegistry;
}

// Trustee routes expose the public "bulletin board" views needed by the
// trustee UI to build decryption shares, plus a relay for submitting shares
// and for the admin-driven final tally combination.
//
// Share generation itself (the trustee's private-key operation) happens in
// the browser against the @ovote/crypto library — the API never sees trustee
// secret shares.
export function trusteeRoutes(deps: TrusteeDeps) {
  return async (app: FastifyInstance) => {
    // Public: aggregate encrypted tallies per option so trustees can run
    // partial decryption. Also returns the raw ballots so trustees can
    // independently reproduce the aggregation.
    app.get<{ Params: { agendaId: string } }>('/agendas/:agendaId/aggregate', async (req, reply) => {
      const agenda = await deps.chain.getAgenda(req.params.agendaId).catch(() => null);
      if (!agenda) return reply.code(404).send({ error: 'agenda not found' });
      if (agenda.status === 'draft') return reply.code(409).send({ error: 'agenda is still draft' });

      const ballots = await deps.chain.listBallots(agenda.id);
      const aggregate = aggregateOptions(agenda, ballots);
      return { agendaId: agenda.id, options: aggregate };
    });

    app.post(
      '/decryption-shares',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('trustee')] },
      async (req, reply) => {
        const body = SubmitShareBody.parse(req.body);
        const share: TrusteeDecryptionShare = parseTrusteeDecryptionShare(body.share);

        const agenda = await deps.chain.getAgenda(share.agendaId).catch(() => null);
        if (!agenda) return reply.code(404).send({ error: 'agenda not found' });
        if (agenda.status !== 'closed') {
          return reply.code(409).send({ error: 'agenda must be closed before decryption' });
        }
        const trustee = agenda.key.trustees.find((t) => t.index === share.trusteeIndex);
        if (!trustee) return reply.code(400).send({ error: 'unknown trustee index' });

        const ballots = await deps.chain.listBallots(agenda.id);
        const aggregate = aggregateOptions(agenda, ballots);
        const ct = aggregate.find((a) => a.optionId === share.optionId);
        if (!ct) return reply.code(400).send({ error: `unknown option ${share.optionId}` });

        const ok = Threshold.verifyDecryptionShare({
          shareValue: {
            index: share.trusteeIndex,
            share: Ristretto.pointFromB64Url(share.share),
            proof: share.proof,
          },
          trusteePk: Ristretto.pointFromB64Url(trustee.pk),
          ct: { c1: Ristretto.pointFromB64Url(ct.c1), c2: Ristretto.pointFromB64Url(ct.c2) },
        });
        if (!ok) return reply.code(400).send({ error: 'decryption share proof failed' });

        try {
          await deps.chain.submitDecryptionShare(share);
        } catch (err) {
          return reply.code(409).send({ error: (err as Error).message });
        }
        reply.code(201).send({ status: 'recorded' });
      },
    );

    // Admin-driven combine-and-publish. Any caller with admin role can run
    // this once a quorum of shares has been submitted; the API combines the
    // shares off-chain (no secrets involved) and publishes the plaintext
    // result to the bulletin board.
    app.post(
      '/results/publish',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req, reply) => {
        const { agendaId } = PublishResultBody.parse(req.body);

        const agenda = await deps.chain.getAgenda(agendaId).catch(() => null);
        if (!agenda) return reply.code(404).send({ error: 'agenda not found' });
        if (agenda.status !== 'closed') {
          return reply.code(409).send({ error: 'agenda must be closed before tally' });
        }

        const ballots = await deps.chain.listBallots(agenda.id);
        const aggregate = aggregateOptions(agenda, ballots);
        const shares = await deps.chain.listDecryptionShares(agenda.id);

        const perOptionShares = new Map<string, TrusteeDecryptionShare[]>();
        for (const s of shares) {
          const bag = perOptionShares.get(s.optionId) ?? [];
          bag.push(s);
          perOptionShares.set(s.optionId, bag);
        }

        const maxCount = ballots.length;
        const results: { optionId: string; count: number }[] = [];
        for (const opt of agenda.options) {
          const ct = aggregate.find((a) => a.optionId === opt.id)!;
          const bag = (perOptionShares.get(opt.id) ?? []).slice(0, agenda.key.threshold);
          if (bag.length < agenda.key.threshold) {
            return reply.code(409).send({
              error: `insufficient decryption shares for option ${opt.id}: have ${bag.length}, need ${agenda.key.threshold}`,
            });
          }
          const m = Threshold.combineShares(
            bag.map((s) => ({
              index: s.trusteeIndex,
              share: Ristretto.pointFromB64Url(s.share),
              proof: s.proof,
            })),
            { c1: Ristretto.pointFromB64Url(ct.c1), c2: Ristretto.pointFromB64Url(ct.c2) },
          );
          const count = ElGamal.discreteLog(m, maxCount);
          results.push({ optionId: opt.id, count });
        }

        const tally: TallyProof = parseTallyProof({
          agendaId: agenda.id,
          results,
          publishedAt: new Date().toISOString(),
        });
        await deps.chain.publishResult(tally);
        reply.code(201).send(tally);
      },
    );
  };
}

// Homomorphic aggregation of per-option ElGamal ciphertexts. Each option gets
// its per-ballot ciphertexts added together; counting the 1-of-2 encoded
// votes then reduces to a single per-option discrete log at tally time.
function aggregateOptions(
  agenda: Agenda,
  ballots: Ballot[],
): { optionId: string; c1: string; c2: string }[] {
  const zero: Point = Ristretto.ZERO;
  const acc = new Map<string, { c1: Point; c2: Point }>();
  for (const opt of agenda.options) {
    acc.set(opt.id, { c1: zero, c2: zero });
  }
  for (const b of ballots) {
    for (const opt of b.options) {
      const cur = acc.get(opt.optionId);
      if (!cur) continue;
      cur.c1 = Ristretto.pointAdd(cur.c1, Ristretto.pointFromB64Url(opt.ciphertext.c1));
      cur.c2 = Ristretto.pointAdd(cur.c2, Ristretto.pointFromB64Url(opt.ciphertext.c2));
    }
  }
  return agenda.options.map((o) => {
    const cur = acc.get(o.id)!;
    return {
      optionId: o.id,
      c1: Ristretto.pointToB64Url(cur.c1),
      c2: Ristretto.pointToB64Url(cur.c2),
    };
  });
}
