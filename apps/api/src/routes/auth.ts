import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Mailer } from '../services/mailer.js';
import type { OtpService, SessionService } from '../services/otp.js';
import type { VoterRegistry } from '../services/voters.js';

const RequestOtpBody = z.object({ email: z.string().email() }).strict();
const VerifyOtpBody = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }).strict();

export interface AuthDeps {
  otp: OtpService;
  sessions: SessionService;
  registry: VoterRegistry;
  mailer: Mailer;
}

export function authRoutes(deps: AuthDeps) {
  return async (app: FastifyInstance) => {
    app.post('/auth/otp/request', async (req, reply) => {
      const { email } = RequestOtpBody.parse(req.body);
      const code = deps.otp.issue(email);
      await deps.mailer.sendOtp(email, code);
      reply.code(202).send({ status: 'otp-sent' });
    });

    app.post('/auth/otp/verify', async (req, reply) => {
      const { email, code } = VerifyOtpBody.parse(req.body);
      if (!deps.otp.verify(email, code)) {
        return reply.code(401).send({ error: 'invalid or expired code' });
      }
      const voter = deps.registry.upsertByEmail(email);
      const token = deps.sessions.create(voter.id);
      reply.send({ sessionToken: token, voter: { id: voter.id, email: voter.email, role: voter.role } });
    });
  };
}
