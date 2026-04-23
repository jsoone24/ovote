import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { parseAgenda } from '@ovote/shared';
import type { Agenda } from '@ovote/shared';
import type { ChainGateway } from '../services/chain.js';
import type { AgendaSigner } from '../services/signer.js';
import type { VoterRegistry } from '../services/voters.js';
import { requireRole, requireSession } from '../middleware/auth.js';
import type { OtpService, SessionService } from '../services/otp.js';

const CreateAgendaBody = z
  .object({
    title: z.string().min(1),
    description: z.string().default(''),
    openAt: z.string().datetime({ offset: true }),
    closeAt: z.string().datetime({ offset: true }),
    options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
    key: z.object({
      groupPk: z.string(),
      threshold: z.number().int().positive(),
      n: z.number().int().positive(),
      trustees: z.array(z.object({ index: z.number().int().positive(), pk: z.string() })),
    }),
  })
  .strict();

const EligibilityBody = z.object({ emails: z.array(z.string().email()).min(1) }).strict();

export interface AgendaRoutesDeps {
  chain: ChainGateway;
  signer: AgendaSigner;
  registry: VoterRegistry;
  sessions: SessionService;
  otp: OtpService;
}

export function agendaRoutes(deps: AgendaRoutesDeps) {
  return async (app: FastifyInstance) => {
    app.get('/agendas', async () => {
      return { agendas: await deps.chain.listAgendas() };
    });

    app.get<{ Params: { id: string } }>('/agendas/:id', async (req, reply) => {
      try {
        return await deps.chain.getAgenda(req.params.id);
      } catch {
        return reply.code(404).send({ error: 'agenda not found' });
      }
    });

    app.post(
      '/agendas',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req, reply) => {
        const body = CreateAgendaBody.parse(req.body);
        const id = randomUUID();
        const { publicSpkiB64Url } = await deps.signer.getOrCreate(id);
        const agenda: Agenda = parseAgenda({
          id,
          title: body.title,
          description: body.description,
          status: 'draft',
          openAt: body.openAt,
          closeAt: body.closeAt,
          options: body.options,
          key: body.key,
          registrarBlindPk: publicSpkiB64Url,
          createdBy: req.voter!.id,
          createdAt: new Date().toISOString(),
        });
        await deps.chain.createAgenda(agenda);
        reply.code(201).send(agenda);
      },
    );

    app.post<{ Params: { id: string } }>(
      '/agendas/:id/open',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req, reply) => {
        await deps.chain.openAgenda(req.params.id);
        reply.send({ status: 'open' });
      },
    );

    app.post<{ Params: { id: string } }>(
      '/agendas/:id/close',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req, reply) => {
        await deps.chain.closeAgenda(req.params.id);
        reply.send({ status: 'closed' });
      },
    );

    app.post<{ Params: { id: string } }>(
      '/agendas/:id/eligibility',
      { preHandler: [requireSession(deps.sessions, deps.registry), requireRole('admin')] },
      async (req, reply) => {
        const { emails } = EligibilityBody.parse(req.body);
        let added = 0;
        for (const email of emails) {
          const voter = deps.registry.upsertByEmail(email);
          deps.registry.addEligibility(voter.id, req.params.id);
          added++;
        }
        reply.send({ added });
      },
    );
  };
}
