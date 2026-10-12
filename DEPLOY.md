# DEPLOY.md — puesta en producción paso a paso

Objetivo: API en Render, PostgreSQL + Storage en Supabase, web en Vercel.
El primer evento es el 2026-10-12 a las 18:00: desplegar y verificar al menos
un día antes.

## 0. Requisitos

- Cuenta Supabase, cuenta Render, cuenta Vercel, cuenta Brevo (SMTP).
- Este repo en GitHub con las migraciones versionadas en
  `packages/api/prisma/migrations/`.

## 1. Supabase: proyecto, base de datos y buckets

1. Crear un proyecto en Supabase (región más cercana: Sudamérica).
2. En Project Settings → Database, copiar:
   - Connection string modo **Transaction pooler** (puerto 6543, con
     `?pgbouncer=true&connection_limit=1`) → `DATABASE_URL`.
   - Connection string **Direct connection** → `DIRECT_URL`.
3. En Storage crear dos buckets:
   - `public-assets` **público** (afiche y copia reducida para `og:image`).
   - `certificate-templates` **privado** (plantillas; solo la API con JWT
     ADMIN las sirve).
4. En Project Settings → API copiar `URL` → `SUPABASE_URL` y
   `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (nunca la `anon key` en el API).

## 2. Migrar y sembrar contra Supabase desde local

```bash
DATABASE_URL="<pooler>" DIRECT_URL="<directa>" npx prisma migrate deploy --schema packages/api/prisma/schema.prisma
ADMIN_EMAIL="<correo>" ADMIN_PASSWORD="<clave-segura>" DATABASE_URL="<pooler>" DIRECT_URL="<directa>" npm run seed -w packages/api
```

Nunca `migrate dev` contra producción. El evento de referencia se carga aparte:

```bash
DATABASE_URL="<pooler>" DIRECT_URL="<directa>" npm run seed:reference -w packages/api
```

## 3. Render: API

1. New → Blueprint → seleccionar el repo (usa `render.yaml` de la raíz).
2. Cargar los secretos (`sync: false`): `DATABASE_URL`, `DIRECT_URL`,
   `JWT_SECRET` (mínimo 16 caracteres), `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, SMTP y `MAIL_FROM`.
3. Fijar `API_PUBLIC_URL` con la URL pública del servicio,
   `CORS_ORIGINS` con `http://localhost:3000` por ahora y `PUBLIC_SITE_URL`
   igual que el dominio final de la web.
4. Deploy → probar `https://<servicio>.onrender.com/health` (200 `{"ok":true}`).

## 4. Vercel: web (monorepo npm workspaces)

1. Importar el repo; **Root Directory** `packages/web` (Framework Preset:
   Next.js).
2. Activar **"Include source files outside of the Root Directory"**: el
   install necesita el `package-lock.json` de la raíz para los workspaces.
3. Comandos (ya fijados en `packages/web/vercel.json`; si el dashboard los
   pide, usar estos valores exactos):
   - Install Command: `cd ../.. && npm ci`
   - Build Command: `cd ../.. && npm run build -w packages/web`
   - Output Directory: el de Next.js por defecto (`.next` dentro de
     `packages/web`; el build corre con cwd en el paquete).
4. Variables: `NEXT_PUBLIC_API_URL=https://<servicio>.onrender.com` (solo host, sin `/api/v1`),
   `NEXT_PUBLIC_SITE_URL=https://<dominio-vercel>`,
   `NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co`.
5. Deploy.
6. Volver a Render: añadir `https://<dominio-vercel>` a `CORS_ORIGINS`
   (separadas por coma) y redesplegar.

## 5. Brevo/SMTP

1. Crear clave SMTP en Brevo y verificar el remitente (`MAIL_FROM`).
2. Cargar `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`,
   `SMTP_PASS` en Render.
3. Probar con una inscripción real: el QR debe llegar por correo; si falla,
   la inscripción igual queda registrada (`mailSent: false` + aviso).

## 6. Verificación final

```bash
npm run smoke -- https://<servicio>.onrender.com
```

- [ ] `/health` responde 200.
- [ ] Página pública del evento muestra el afiche.
- [ ] Inscripción de prueba genera QR y aparece en inscritos.
- [ ] Escaneo con el celular registra asistencia.
- [ ] Exportación xlsx descarga.
- [ ] Origen ajeno es rechazado por CORS.

## 7. Plan gratuito de Render (cold start)

El plan gratis suspende el API sin tráfico (~50 s de arranque en frío).
Antes del evento: abrir `https://<servicio>.onrender.com/health` 5 minutos
antes y dejar una pestaña que lo recargue cada 10 minutos durante el registro
en puerta. Para eliminar el problema, subir el plan de pago.

## 8. Rollback

- Render: Deploys → seleccionar el deploy anterior → Rollback.
- Vercel: Deployments → … → Promote to Production en el deployment previo.
- Base de datos: `migrate deploy` solo avanza; un rollback de esquema se hace
  con una migración nueva que revierta el cambio (nunca editar migraciones
  aplicadas).
