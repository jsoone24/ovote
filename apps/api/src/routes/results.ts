import type { FastifyInstance } from 'fastify';
import type { ChainGateway } from '../services/chain.js';

export function resultRoutes(chain: ChainGateway) {
  return async (app: FastifyInstance) => {
    app.get<{ Params: { agendaId: string } }>('/results/:agendaId', async (req, reply) => {
      const result = await chain.getResult(req.params.agendaId);
      if (!result) return reply.code(404).send({ error: 'no result published' });
      reply.send(result);
    });

    app.get<{ Params: { agendaId: string } }>('/decryption-shares/:agendaId', async (req) => {
      return { shares: await chain.listDecryptionShares(req.params.agendaId) };
    });
  };
}
