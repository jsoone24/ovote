import Fastify, { type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
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
import { adminRoutes } from './routes/admin.js';

export interface AppDeps {
  config: Config;
  chain?: ChainGateway;
  mailer?: Mailer;
}

export async function buildServer(deps: AppDeps) {
  const app = Fastify({
    logger: { level: deps.config.OVOTE_LOG_LEVEL },
    trustProxy: resolveTrustProxy(deps.config.OVOTE_TRUST_PROXY),
  });

  await app.register(cors, { origin: resolveCorsOrigin(deps.config.OVOTE_CORS_ORIGINS) });
  await app.register(sensible);

  // Any schema- or crypto-decode failure should surface as 400, not 500. Zod
  // validation errors and base64url/curve-point decode errors share the same
  // property: bad client input. Everything else is genuinely internal and keeps
  // its 500 so we still see it in logs.
  app.setErrorHandler((err: unknown, req, reply) => {
    if (reply.sent) return;
    if (err instanceof ZodError) {
      const msg = err.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: `invalid request: ${msg}` });
    }
    const e = err as { message?: string; statusCode?: number; validation?: unknown };
    if (e.validation || e.statusCode === 400) {
      return reply.code(400).send({ error: e.message ?? 'bad request' });
    }
    if (e.statusCode && e.statusCode < 500) {
      return reply.code(e.statusCode).send({ error: e.message ?? 'error' });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal server error' });
  });

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
  const secretKey = resolveSecretKey(deps.config.OVOTE_SECRET_KEY, deps.config.OVOTE_DB_PATH);
  const otp = new OtpService(
    db,
    deps.config.OVOTE_OTP_TTL_MINUTES,
    deps.config.OVOTE_OTP_MAX_ATTEMPTS,
    secretKey,
  );
  const sessions = new SessionService(db, deps.config.OVOTE_SESSION_TTL_MINUTES);
  const registry = new VoterRegistry(db);
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
  await app.register(adminRoutes({ registry, sessions, otp }));
  await app.register(resultRoutes(chain));

  // Background sweep of expired OTPs and sessions. resolve()/verify() also
  // evict on touch, but rows for emails or tokens that never come back never
  // get cleaned up otherwise. Cheap deletes; once a minute is plenty.
  const sweepInterval = setInterval(() => {
    try {
      const otpRows = otp.sweepExpired();
      const sessionRows = sessions.sweepExpired();
      if (otpRows + sessionRows > 0) {
        app.log.debug({ otpRows, sessionRows }, 'swept expired auth rows');
      }
    } catch (err) {
      app.log.warn({ err }, 'auth sweep failed');
    }
  }, 60_000);
  sweepInterval.unref();

  app.addHook('onClose', async () => {
    clearInterval(sweepInterval);
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

// Parses OVOTE_CORS_ORIGINS. "*" means reflect any origin (dev only). Anything
// else is treated as a comma-separated allowlist and passed verbatim.
function resolveCorsOrigin(raw: string): true | string[] {
  if (raw === '*' || raw === '') return true;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// Parses OVOTE_TRUST_PROXY. "false"/"" -> don't trust; "true" -> trust all;
// a number -> hop count; a string containing "/" -> treated as a CIDR the
// library understands.
function resolveTrustProxy(raw: string): boolean | number | string {
  if (raw === '' || raw.toLowerCase() === 'false') return false;
  if (raw.toLowerCase() === 'true') return true;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  return raw;
}
