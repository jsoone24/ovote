import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import type { Config } from './config.js';
import { openDatabase } from './db.js';
import { MemoryChain, type ChainGateway } from './services/chain.js';
import { OtpService, SessionService } from './services/otp.js';
import { VoterRegistry } from './services/voters.js';
import { ConsoleMailer } from './services/mailer.js';
import { AgendaSigner } from './services/signer.js';
import { authRoutes } from './routes/auth.js';
import { agendaRoutes } from './routes/agendas.js';
import { credentialRoutes } from './routes/credentials.js';
import { ballotRoutes } from './routes/ballots.js';
import { resultRoutes } from './routes/results.js';

export interface AppDeps {
  config: Config;
  chain?: ChainGateway;
}

export async function buildServer(deps: AppDeps) {
  const app = Fastify({
    logger: { level: deps.config.OVOTE_LOG_LEVEL },
  });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  const db = openDatabase(deps.config.OVOTE_DB_PATH);
  const chain: ChainGateway = deps.chain ?? new MemoryChain();
  const mailer = new ConsoleMailer(app.log);
  const otp = new OtpService(db, deps.config.OVOTE_OTP_TTL_MINUTES, deps.config.OVOTE_OTP_MAX_ATTEMPTS);
  const sessions = new SessionService(db, deps.config.OVOTE_SESSION_TTL_MINUTES);
  const registry = new VoterRegistry(db);
  const signer = new AgendaSigner(db, deps.config.OVOTE_BLIND_RSA_MODULUS as 2048 | 3072 | 4096);

  if (deps.config.OVOTE_ADMIN_BOOTSTRAP_EMAIL) {
    const admin = registry.upsertByEmail(deps.config.OVOTE_ADMIN_BOOTSTRAP_EMAIL);
    db.prepare(`UPDATE voters SET role = 'admin' WHERE id = ?`).run(admin.id);
    app.log.info({ email: admin.email }, 'bootstrap admin registered');
  }

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes({ otp, sessions, registry, mailer }));
  await app.register(agendaRoutes({ chain, signer, registry, sessions, otp }));
  await app.register(credentialRoutes({ chain, signer, registry, sessions, otp }));
  await app.register(ballotRoutes({ chain }));
  await app.register(resultRoutes(chain));

  app.addHook('onClose', async () => {
    db.close();
  });

  return app;
}
