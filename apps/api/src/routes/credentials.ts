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
        if (deps.registry.hasIssuedCredential(voter.id, body.agendaId)) {
          return reply.code(409).send({ error: 'credential already issued for this agenda' });
        }

        const { privateKey } = await deps.signer.getOrCreate(body.agendaId);
        const blindedBytes = fromB64Url(body.blindedMessage);
        const blindSig = await BlindSignature.blindSign(privateKey, blindedBytes);

        // Record issuance BEFORE returning signature so a network failure can
        // re-enable retry; voter gets the signature once and the registrar
        // refuses further signatures on the same agenda for this voter.
        deps.registry.recordCredentialIssued(voter.id, body.agendaId);

        reply.send({ blindSignature: toB64Url(blindSig) });
      },
    );
  };
}
