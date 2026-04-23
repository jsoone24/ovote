import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SessionService } from '../services/otp.js';
import type { VoterRegistry } from '../services/voters.js';
import type { Voter } from '../services/voters.js';

declare module 'fastify' {
  interface FastifyRequest {
    voter?: Voter;
  }
}

export function requireSession(sessions: SessionService, registry: VoterRegistry) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) return reply.code(401).send({ error: 'missing bearer token' });
    const voterId = sessions.resolve(token);
    if (!voterId) return reply.code(401).send({ error: 'invalid or expired session' });
    const voter = registry.findById(voterId);
    if (!voter) return reply.code(401).send({ error: 'voter not found' });
    req.voter = voter;
    return;
  };
}

export function requireRole(role: Voter['role']) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.voter) return reply.code(401).send({ error: 'session required' });
    if (req.voter.role !== role) return reply.code(403).send({ error: `${role} role required` });
    return;
  };
}
