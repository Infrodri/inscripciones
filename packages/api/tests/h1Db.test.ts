import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../src/infrastructure/prisma.js';

const stamp = Date.now();

describe('H1 restricción de default único', () => {
  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h1tpl-${stamp}` } } });
    await prisma.$disconnect();
  });

  it('solo una plantilla default por (evento, rol)', async () => {
    const prisma = getPrisma();
    const event = await prisma.event.create({
      data: {
        slug: `h1tpl-${stamp}`,
        title: 'H1 templates',
        eventKind: 'K',
        institution: 'I',
        organizer: 'O',
        location: 'L',
      },
    });
    const base = {
      eventId: event.id,
      roleKind: 'ASISTENTE' as const,
      name: 'T',
      filePath: 'privada/t.png',
      widthPx: 2000,
      heightPx: 1414,
      pageWidthMm: 297,
      pageHeightMm: 210,
      nameBox: {},
      isDefault: true,
    };
    await prisma.certificateTemplate.create({ data: base });
    await expect(
      prisma.certificateTemplate.create({ data: { ...base, name: 'T2' } })
    ).rejects.toThrow();
    // Otro rol sí admite su propio default.
    await prisma.certificateTemplate.create({
      data: { ...base, name: 'T3', roleKind: 'EXPOSITOR' },
    });
  });
});
