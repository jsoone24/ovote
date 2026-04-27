import type { FastifyBaseLogger } from 'fastify';
import { createTransport, type Transporter } from 'nodemailer';

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

// SmtpMailer uses nodemailer with a URL-style connection string. The
// transporter is lazily instantiated so a bad URL doesn't crash the whole
// server at boot — it surfaces on the first send attempt.
export class SmtpMailer implements Mailer {
  private transporter?: Transporter;

  constructor(
    private readonly url: string,
    private readonly from: string,
    // ttlMinutes is interpolated into the email body so the message stays
    // truthful when an operator overrides OVOTE_OTP_TTL_MINUTES.
    private readonly ttlMinutes: number,
  ) {}

  private get transport(): Transporter {
    if (!this.transporter) this.transporter = createTransport(this.url);
    return this.transporter;
  }

  async sendOtp(email: string, code: string): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: email,
      subject: 'Your ovote sign-in code',
      text: `Your one-time sign-in code is ${code}. It expires in ${this.ttlMinutes} minute${this.ttlMinutes === 1 ? '' : 's'}.`,
    });
  }
}
