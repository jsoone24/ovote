import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { VoterRegistry } from '../services/voters.js';
import type { OtpService, SessionService } from '../services/otp.js';
import { requireRole, requireSession } from '../middleware/auth.js';

const SetRoleBody = z
  .object({
    email: z.string().email(),
    role: z.enum(['voter', 'admin', 'trustee']),
  })
  .strict();

export interface AdminDeps {
  registry: VoterRegistry;
  sessions: SessionService;
  otp: OtpService;
}

// Admin routes that don't fit under /agendas — voter management and a lookup
// for the eligibility roster. All mutations require admin role.
export function adminRoutes(deps: AdminDeps) {
  return async (app: FastifyInstance) => {
    app.get(
      '/admin/voters',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async () => ({ voters: deps.registry.listAll() }),
    );

    app.post(
      '/admin/voters/role',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req, reply) => {
        const { email, role } = SetRoleBody.parse(req.body);
        const voter = deps.registry.findByEmail(email);
        if (!voter) return reply.code(404).send({ error: 'voter not found' });
        deps.registry.setRole(voter.id, role);
        return { voter: { ...voter, role } };
      },
    );

    app.get<{ Params: { agendaId: string } }>(
      '/admin/agendas/:agendaId/eligibility',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req) => ({ voters: deps.registry.listEligibility(req.params.agendaId) }),
    );
  };
}
