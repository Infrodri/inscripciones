import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

// Alta manual de usuarios: npm run create-admin -- --email=.. --password=.. --name=.. [--role=STAFF]
async function main(): Promise<void> {
  const email = arg('email') ?? process.env.ADMIN_EMAIL;
  const password = arg('password') ?? process.env.ADMIN_PASSWORD;
  const name = arg('name') ?? 'Staff';
  const role = (arg('role') ?? 'STAFF').toUpperCase();
  if (!email || !password)
    throw new Error('Indique --email y --password (o ADMIN_EMAIL/ADMIN_PASSWORD)');
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
  if (role !== 'ADMIN' && role !== 'STAFF') throw new Error('El rol debe ser ADMIN o STAFF');
  const created = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), name, role },
  });
  // eslint-disable-next-line no-console
  console.log(`Usuario OK: ${created.email} (${created.role})`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
