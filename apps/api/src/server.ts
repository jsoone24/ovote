import Fastify, { type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.js';
import { openDatabase } from './db.js';
import { MemoryChain, type ChainGateway } from './services/chain.js';
import { FabricChain } from './services/fabric-chain.js';
import { OtpService, SessionService } from './services/otp.js';
import { VoterRegistry } from './services/voters.js';
import { ConsoleMailer, SmtpMailer, type Mailer } from './services/mailer.js';
import { AgendaSigner } from './services/signer.js';
import { resolveSecretKey } from './services/secret-key.js';
import { authRoutes } from './routes/auth.js';
import { agendaRoutes } from './routes/agendas.js';
import { credentialRoutes } from './routes/credentials.js';
import { ballotRoutes } from './routes/ballots.js';
import { resultRoutes } from './routes/results.js';
import { trusteeRoutes } from './routes/trustees.js';

export interface AppDeps {
  config: Config;
  chain?: ChainGateway;
  mailer?: Mailer;
}

export async function buildServer(deps: AppDeps) {
  const app = Fastify({
    logger: { level: deps.config.OVOTE_LOG_LEVEL },
    trustProxy: true,
  });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  // Global rate limit floor. Per-route caps (tighter) live on the auth and
  // credential endpoints that take email or issue secrets.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: (req) => req.url === '/health',
  });

  const db = openDatabase(deps.config.OVOTE_DB_PATH);
  const chain = deps.chain ?? (await buildChain(deps.config, app.log));
  const mailer = deps.mailer ?? buildMailer(deps.config, app.log);
  const otp = new OtpService(db, deps.config.OVOTE_OTP_TTL_MINUTES, deps.config.OVOTE_OTP_MAX_ATTEMPTS);
  const sessions = new SessionService(db, deps.config.OVOTE_SESSION_TTL_MINUTES);
  const registry = new VoterRegistry(db);
  const secretKey = resolveSecretKey(deps.config.OVOTE_SECRET_KEY, deps.config.OVOTE_DB_PATH);
  const signer = new AgendaSigner(
    db,
    deps.config.OVOTE_BLIND_RSA_MODULUS as 2048 | 3072 | 4096,
    secretKey,
  );

  if (deps.config.OVOTE_ADMIN_BOOTSTRAP_EMAIL) {
    const admin = registry.upsertByEmail(deps.config.OVOTE_ADMIN_BOOTSTRAP_EMAIL);
    db.prepare(`UPDATE voters SET role = 'admin' WHERE id = ?`).run(admin.id);
    app.log.info({ email: admin.email }, 'bootstrap admin registered');
  }

  app.get('/health', async () => ({ status: 'ok', chain: deps.config.OVOTE_CHAIN_DRIVER }));

  await app.register(authRoutes({ otp, sessions, registry, mailer }));
  await app.register(agendaRoutes({ chain, signer, registry, sessions, otp }));
  await app.register(credentialRoutes({ chain, signer, registry, sessions, otp }));
  await app.register(ballotRoutes({ chain }));
  await app.register(trusteeRoutes({ chain, sessions, registry }));
  await app.register(resultRoutes(chain));

  app.addHook('onClose', async () => {
    if (chain instanceof FabricChain) await chain.close();
    db.close();
  });

  return app;
}

async function buildChain(config: Config, log: FastifyBaseLogger): Promise<ChainGateway> {
  if (config.OVOTE_CHAIN_DRIVER === 'fabric') {
    log.info(
      { endpoint: config.OVOTE_FABRIC_PEER_ENDPOINT, msp: config.OVOTE_FABRIC_MSP_ID },
      'connecting to Fabric gateway',
    );
    return FabricChain.connect(config);
  }
  return new MemoryChain();
}

function buildMailer(config: Config, log: FastifyBaseLogger): Mailer {
  if (config.OVOTE_SMTP_URL) return new SmtpMailer(config.OVOTE_SMTP_URL, config.OVOTE_SMTP_FROM);
  return new ConsoleMailer(log);
}
