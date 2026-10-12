import { describe, expect, it } from 'vitest';
import { buildConfirmationMail } from '../src/application/confirmationMail.js';

const event = {
  title: 'Conversatorio de prueba',
  institution: 'Universidad de prueba',
  location: 'Salón de Honor',
  contactWhatsapp: '67635450',
  sessions: [{ startsAt: new Date('2026-10-12T18:00:00-04:00'), location: null }],
};

const participant = { firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.com' };

describe('buildConfirmationMail', () => {
  it('asunto con el título y saludo con nombre', () => {
    const mail = buildConfirmationMail(participant, event);
    expect(mail.subject).toBe('Tu inscripción: Conversatorio de prueba');
    expect(mail.to).toBe('ana@test.com');
    expect(mail.text).toMatch(/Estimada\/o Ana Pérez/);
    expect(mail.html).toMatch(/Ana Pérez/);
  });
  it('incluye fecha, hora, lugar e instrucción del QR', () => {
    const mail = buildConfirmationMail(participant, event);
    expect(mail.text).toMatch(/12 de octubre de 2026/);
    expect(mail.text).toMatch(/06:00|18:00/);
    expect(mail.text).toMatch(/Salón de Honor/);
    expect(mail.text).toMatch(/Presente este código QR en la puerta del evento/);
    expect(mail.text).toMatch(/Contacto por WhatsApp: 67635450/);
  });
  it('HTML sin imágenes remotas, solo QR incrustado', () => {
    const mail = buildConfirmationMail(participant, event);
    expect(mail.html).toMatch(/cid:qr@inscripciones/);
    expect(mail.html).not.toMatch(/https?:\/\//);
  });
  it('sin WhatsApp no incluye la línea de contacto', () => {
    const mail = buildConfirmationMail(participant, { ...event, contactWhatsapp: null });
    expect(mail.text).not.toMatch(/WhatsApp/);
    expect(mail.html).not.toMatch(/WhatsApp/);
  });
});
