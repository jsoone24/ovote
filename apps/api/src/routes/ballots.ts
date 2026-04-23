import type { FastifyInstance } from 'fastify';
import { parseBallot } from '@ovote/shared';
import type { ChainGateway } from '../services/chain.js';
import { verifyBallot } from '../services/ballot-verifier.js';

export interface BallotDeps {
  chain: ChainGateway;
}

export function ballotRoutes(deps: BallotDeps) {
  return async (app: FastifyInstance) => {
    // Ballots are posted by the voter client directly — the blind-signed
    // credential IS the eligibility proof; no session token is needed (or
    // wanted, since it would reintroduce a linkability vector between voter
    // and ballot).
    app.post('/ballots', async (req, reply) => {
      const ballot = parseBallot(req.body);

      const agenda = await deps.chain.getAgenda(ballot.agendaId).catch(() => null);
      if (!agenda) return reply.code(404).send({ error: 'agenda not found' });
      if (agenda.status !== 'open') return reply.code(409).send({ error: 'agenda not open' });
      const now = Date.now();
      if (now < new Date(agenda.openAt).getTime() || now >= new Date(agenda.closeAt).getTime()) {
        return reply.code(409).send({ error: 'outside voting window' });
      }

      const verdict = await verifyBallot(agenda, ballot);
      if (!verdict.ok) return reply.code(400).send({ error: verdict.reason });

      try {
        await deps.chain.castBallot(ballot);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('credential already used')) return reply.code(409).send({ error: msg });
        return reply.code(500).send({ error: `chain rejected ballot: ${msg}` });
      }

      reply.code(201).send({ id: ballot.id, status: 'recorded' });
    });

    app.get<{ Params: { agendaId: string } }>('/ballots/:agendaId', async (req) => {
      return { ballots: await deps.chain.listBallots(req.params.agendaId) };
    });
  };
}
