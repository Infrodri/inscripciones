import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'La variable DATABASE_URL es obligatoria'),
  DIRECT_URL: z.string().min(1, 'La variable DIRECT_URL es obligatoria').optional(),
  JWT_SECRET: z.string().min(16, 'La variable JWT_SECRET es obligatoria (mínimo 16 caracteres)'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGINS: z.string().min(1, 'La variable CORS_ORIGINS es obligatoria'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  STORAGE_DRIVER: z.enum(['disk', 'supabase']).default('disk'),
  UPLOADS_DIR: z.string().default('./uploads'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_PUBLIC_BUCKET: z.string().default('public-assets'),
  SUPABASE_PRIVATE_BUCKET: z.string().default('certificate-templates'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('no-reply@example.com'),
  PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Variables de entorno inválidas: ${missing}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'disk') {
    throw new Error(
      'La variable STORAGE_DRIVER no puede ser "disk" en producción: el disco de Render es efímero'
    );
  }
  if (env.STORAGE_DRIVER === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error(
      'Con STORAGE_DRIVER=supabase, las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias'
    );
  }
  return env;
}
