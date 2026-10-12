import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';

const prisma = new PrismaClient();

// Seed seguro: solo crea el ADMIN desde env. Sin contraseñas por defecto.
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Las variables ADMIN_EMAIL y ADMIN_PASSWORD son obligatorias para el seed');
  }
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await hashPassword(password), name: 'Admin', role: 'ADMIN' },
  });
  // eslint-disable-next-line no-console
  console.log(`Admin OK: ${admin.email}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
