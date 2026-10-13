import nodemailer from 'nodemailer';
import type { AppEnv } from '../api/env.js';

export interface CertificateMail {
  to: string;
  subject: string;
  text: string;
  pdf: Buffer;
  filename: string;
}

// Transporte inyectable para tests (sin red). En producción, SMTP del env.
let testTransport: nodemailer.Transporter | null = null;

export function __setTestTransport(transport: nodemailer.Transporter | null): void {
  testTransport = transport;
}

export function buildCertificateTransport(env: AppEnv): nodemailer.Transporter {
  if (testTransport) return testTransport;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER ?? '', pass: env.SMTP_PASS ?? '' },
  });
}

export async function sendCertificateMail(env: AppEnv, message: CertificateMail): Promise<void> {
  const transporter = buildCertificateTransport(env);
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    attachments: [
      { filename: message.filename, content: message.pdf, contentType: 'application/pdf' },
    ],
  });
}

export function defaultCertificateSubject(eventTitle: string): string {
  return `Tu certificado: ${eventTitle}`;
}

export function defaultCertificateBody(eventTitle: string, eventDate: string): string {
  return [
    `Estimada/o participante:`,
    ``,
    `Adjunto encontrará su certificado de "${eventTitle}" (${eventDate}).`,
    ``,
    `Gracias por su participación.`,
  ].join('\n');
}
