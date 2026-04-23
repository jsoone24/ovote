import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BlindSignature } from '@ovote/crypto';
import { fromB64Url, toB64Url } from '@ovote/shared';
import type { ChainGateway } from '../services/chain.js';
import type { AgendaSigner } from '../services/signer.js';
import type { VoterRegistry } from '../services/voters.js';
import { requireSession } from '../middleware/auth.js';
import type { OtpService, SessionService } from '../services/otp.js';

const BlindSignBody = z
  .object({
    agendaId: z.string().uuid(),
    blindedMessage: z.string().min(1),
  })
  .strict();

export interface CredentialDeps {
  chain: ChainGateway;
  signer: AgendaSigner;
  registry: VoterRegistry;
  sessions: SessionService;
  otp: OtpService;
}

export function credentialRoutes(deps: CredentialDeps) {
  return async (app: FastifyInstance) => {
    app.post(
      '/credentials/blind-sign',
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        preHandler: [requireSession(deps.sessions, deps.registry)],
      },
      async (req, reply) => {
        const body = BlindSignBody.parse(req.body);
        const voter = req.voter!;

        const agenda = await deps.chain.getAgenda(body.agendaId).catch(() => null);
        if (!agenda) return reply.code(404).send({ error: 'agenda not found' });
        if (agenda.status !== 'open') {
          return reply.code(409).send({ error: 'agenda is not open for credential issuance' });
        }
        if (!deps.registry.isEligible(voter.id, body.agendaId)) {
          return reply.code(403).send({ error: 'voter not on eligibility roster' });
        }

        // Idempotent retry: if the voter has already received a signature for
        // this agenda, only replay it when the request carries the exact same
        // blinded message. A different blinded message means a second
        // credential attempt — refuse (one credential per voter per agenda).
        const existing = deps.registry.findIssuedCredential(voter.id, body.agendaId);
        if (existing) {
          if (existing.blindedMessage === body.blindedMessage) {
            reply.send({ blindSignature: existing.blindSignature });
            return;
          }
          return reply.code(409).send({ error: 'credential already issued for this agenda' });
        }

        const { privateKey } = await deps.signer.getOrCreate(body.agendaId);
        const blindedBytes = fromB64Url(body.blindedMessage);
        const blindSig = await BlindSignature.blindSign(privateKey, blindedBytes);
        const blindSigB64 = toB64Url(blindSig);

        // Persist the (blindedMessage, blindSignature) pair so a lost response
        // can be recovered by the voter replaying the same request — without
        // that, a network glitch between DB write and HTTP response would
        // permanently lock the voter out for this agenda.
        deps.registry.recordCredentialIssued(
          voter.id,
          body.agendaId,
          body.blindedMessage,
          blindSigB64,
        );

        reply.send({ blindSignature: blindSigB64 });
      },
    );
  };
}
