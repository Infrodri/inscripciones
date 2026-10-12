import nodemailer from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  qrPng?: Buffer;
}

export const QR_CONTENT_ID = 'qr@inscripciones';

export function createMailer(config: MailConfig) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: { user: config.user, pass: config.pass },
  });
  return {
    sendMail(message: MailMessage): Promise<void> {
      return transporter
        .sendMail({
          from: config.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          // El QR va incrustado (cid) y a la vez adjunto como PNG.
          attachments: message.qrPng
            ? [
                {
                  filename: 'qr.png',
                  content: message.qrPng,
                  contentType: 'image/png',
                  cid: QR_CONTENT_ID,
                },
              ]
            : [],
        })
        .then(() => undefined);
    },
  };
}
