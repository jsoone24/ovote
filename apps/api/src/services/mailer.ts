import type { FastifyBaseLogger } from 'fastify';

export interface Mailer {
  sendOtp(email: string, code: string): Promise<void>;
}

// ConsoleMailer writes OTPs to the log. Use only for development. Swap for an
// SMTP transport in production — any Mailer implementation works.
export class ConsoleMailer implements Mailer {
  constructor(private readonly log: FastifyBaseLogger) {}

  async sendOtp(email: string, code: string): Promise<void> {
    this.log.warn({ email, code }, 'OTP (dev mailer — do NOT run in production)');
  }
}
