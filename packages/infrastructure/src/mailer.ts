import nodemailer from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function createMailer(config: MailConfig) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: { user: config.user, pass: config.pass },
  });
  return {
    sendQrMail(to: string, subject: string, html: string, qrPng?: Buffer): Promise<void> {
      return transporter
        .sendMail({
          from: config.from,
          to,
          subject,
          html,
          attachments: qrPng
            ? [{ filename: 'qr.png', content: qrPng, contentType: 'image/png' }]
            : [],
        })
        .then(() => undefined);
    },
  };
}
