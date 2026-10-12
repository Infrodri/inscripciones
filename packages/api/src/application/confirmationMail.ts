import { QR_CONTENT_ID } from '@inscripciones/infrastructure/mailer.js';

export interface ConfirmationEvent {
  title: string;
  institution: string;
  location: string;
  contactWhatsapp: string | null;
  sessions: Array<{ startsAt: Date; location: string | null }>;
}

export interface ConfirmationParticipant {
  firstName: string;
  lastName: string;
  email: string;
}

export interface ConfirmationMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatSession(startsAt: Date): { date: string; time: string } {
  const date = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(startsAt);
  const time = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
  }).format(startsAt);
  return { date, time };
}

export function buildConfirmationMail(
  participant: ConfirmationParticipant,
  event: ConfirmationEvent
): ConfirmationMail {
  const name = `${participant.firstName} ${participant.lastName}`;
  const lines = event.sessions.map((session) => {
    const { date, time } = formatSession(session.startsAt);
    const place = session.location ?? event.location;
    return { date, time, place };
  });
  const subject = `Tu inscripción: ${event.title}`;
  const textLines = [
    `Estimada/o ${name}:`,
    '',
    `Su inscripción a "${event.title}" quedó confirmada.`,
    '',
    ...lines.flatMap((line) => [
      `Fecha: ${line.date}`,
      `Hora: ${line.time}`,
      `Lugar: ${line.place}`,
      '',
    ]),
    'Presente este código QR en la puerta del evento (en pantalla o impreso).',
    'El código también va adjunto a este correo como imagen PNG.',
    '',
    event.institution,
  ];
  if (event.contactWhatsapp) textLines.push(`Contacto por WhatsApp: ${event.contactWhatsapp}`);
  const htmlItems = lines
    .map(
      (line) =>
        `<li><strong>Fecha:</strong> ${escapeHtml(line.date)}<br><strong>Hora:</strong> ${escapeHtml(line.time)}<br><strong>Lugar:</strong> ${escapeHtml(line.place)}</li>`
    )
    .join('');
  const html = [
    `<p>Estimada/o ${escapeHtml(name)}:</p>`,
    `<p>Su inscripción a <strong>${escapeHtml(event.title)}</strong> quedó confirmada.</p>`,
    `<ul>${htmlItems}</ul>`,
    '<p>Presente este código QR en la puerta del evento (en pantalla o impreso).</p>',
    `<img src="cid:${QR_CONTENT_ID}" alt="Código QR de ingreso">`,
    `<p>${escapeHtml(event.institution)}</p>`,
    event.contactWhatsapp
      ? `<p>Contacto por WhatsApp: ${escapeHtml(event.contactWhatsapp)}</p>`
      : '',
  ].join('\n');
  return { to: participant.email, subject, text: textLines.join('\n'), html };
}
