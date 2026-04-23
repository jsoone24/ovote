import { z } from 'zod';

const schema = z.object({
  OVOTE_API_PORT: z.coerce.number().int().nonnegative().default(3000),
  OVOTE_API_HOST: z.string().default('127.0.0.1'),
  OVOTE_DB_PATH: z.string().default('./.cache/ovote-api.sqlite'),
  OVOTE_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OVOTE_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  OVOTE_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OVOTE_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OVOTE_CHAIN_DRIVER: z.enum(['memory', 'fabric']).default('memory'),
  OVOTE_BLIND_RSA_MODULUS: z.coerce.number().int().refine((n) => n === 2048 || n === 3072 || n === 4096).default(3072),
  OVOTE_ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),

  // Mailer — ConsoleMailer (log only) if OVOTE_SMTP_URL is unset.
  // Format: smtp[s]://user:pass@host:port, e.g. smtps://apikey:…@smtp.sendgrid.net:465
  OVOTE_SMTP_URL: z.string().url().optional(),
  OVOTE_SMTP_FROM: z.string().email().default('no-reply@ovote.local'),

  // Base64url-encoded 32 random bytes used as the AES-GCM key for
  // encrypting per-agenda blind-signing RSA keys at rest. If unset, the API
  // generates one on first boot and persists it to a sibling file beside
  // OVOTE_DB_PATH (mode 0600) — fine for single-host dev, but production
  // deployments MUST provision the key out-of-band and inject it here.
  OVOTE_SECRET_KEY: z.string().optional(),

  // Fabric gateway — required only when OVOTE_CHAIN_DRIVER=fabric. Unused
  // in memory mode so the API still boots on a fresh checkout.
  OVOTE_FABRIC_CHANNEL: z.string().default('ovote-channel'),
  OVOTE_FABRIC_CHAINCODE: z.string().default('ovote'),
  OVOTE_FABRIC_MSP_ID: z.string().default('Org1MSP'),
  OVOTE_FABRIC_PEER_ENDPOINT: z.string().default('localhost:7051'),
  OVOTE_FABRIC_PEER_HOSTNAME_OVERRIDE: z.string().default('peer0.org1.ovote.local'),
  OVOTE_FABRIC_TLS_ROOT_CERT: z.string().optional(),
  OVOTE_FABRIC_SIGNCERT: z.string().optional(),
  OVOTE_FABRIC_KEYSTORE_DIR: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
