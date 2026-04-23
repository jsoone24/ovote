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
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
