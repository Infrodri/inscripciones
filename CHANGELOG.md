# CHANGELOG

## [0.5.0] — feat(h5): certificados base

- Plantillas: subida PNG/JPG 15 MB con detección de página A4/Carta,
  `set-default` transaccional, duplicar variante, archivo y `preview.pdf`
  servidos solo a ADMIN.
- Exportación ASISTENTE en streaming (un certificado por página, orden por
  apellido, `certificate_code` perezoso, reporte por log).
- Web: pestañas de certificados, editor visual de la caja (arrastrar,
  redimensionar, fuentes, vista previa, nombre más largo), asistentes
  (aptos, exportar).
- Tests: 49/49 (layout auto-shrink, página, upload, default, preview,
  aptos, `NO_DEFAULT_TEMPLATE`).

- `render.yaml` (build desde raíz, `migrate deploy`, `/health`,
  `NODE_VERSION=24`); `.env.example` completos en raíz, api y web.
- `DEPLOY.md` paso a paso (Supabase, migrate+seed, Render, Vercel,
  Brevo, verificación, cold start, rollback).
- `scripts/smoke.ts` (`npm run smoke -- <BASE_URL>`): 4/4 en local.

- Check-in con ventana de sesión, doble escaneo (`ALREADY_CHECKED_IN` sin
  duplicar), QR inválido y fuera de ventana; búsqueda manual; puerta
  (WALK_IN + asistencia en un paso); anulación ADMIN con motivo y auditoría;
  `/stats` con porcentaje y aptos.
- Web `/scan/[sessionId]` mobile-first (verde/ámbar/rojo) + puerta.
- Tests: 39/39 (doble escaneo, QR inválido, ventana, porcentaje con
  anuladas, void con roles).

- API pública: `GET /public/events/:slug` (sin datos personales),
  `POST /public/events/:slug/registrations` (honeypot + rate limit, cupo
  transaccional con `FOR UPDATE`, duplicados por P2002),
  `GET /public/registrations/:qrToken/qr.png`; QR por correo fail-soft.
- Inscritos (ADMIN/STAFF) y exportaciones xlsx/csv (ADMIN).
- Web: `/e/[slug]` (og:image), `/e/[slug]/inscripcion` (QR descargable),
  admin (login, eventos, nuevo con afiche/duplicar, detalle con sesiones,
  expositores, auspiciantes e inscritos, usuarios STAFF), difusión WhatsApp.
- Tests: 32/32 (cupo concurrente, duplicados, cierre, honeypot, sin PII).

- `typescript-eslint@8.71.1` + lint TS/TSX en `npm run lint`.
- Afiche guarda original + copia 1200px en bucket público; `publish`/`duplicate`
  (copia plantillas, no inscritos); PUT en sesiones/expositores/auspiciantes.
- `GET /health` con consulta a BD; env validado con zod; `trust proxy`;
  `CORS_ORIGINS`; escucha en `PORT`/`0.0.0.0`; `STORAGE_DRIVER` con fallo en
  producción con disk.
- Seed solo ADMIN (`ADMIN_EMAIL`/`ADMIN_PASSWORD`); `seed:reference` bloqueado
  en producción sin `--force`; `scripts/create-admin.ts`; alta de STAFF por API.
- Logs JSON sin datos personales; `directUrl` en Prisma.
- Tests: 26/26 (roles, health, env, default único, duplicado, afiche).

- Monorepo npm workspaces (`api`, `web`, `infrastructure`) con TS 5.5, vitest, eslint 8 + prettier.
- Schema Prisma completo (users, events, sponsors, speakers, sessions, participants, attendances, certificate_templates, certificate_recipients, audit_logs) + migración SQL manual (CHECK sessions, único parcial default por evento+rol).
- Seed del evento de referencia USFX 2026-10-12 y segundo evento TEST con 3 sesiones.
- Auth JWT 24h + bcryptjs; CRUD eventos/sesiones/expositores/auspiciantes; subida de afiche (multer 2.x + sharp, 10 MB, copia 1200px); duplicar evento; middleware único de errores en español.
- Adaptadores en `packages/infrastructure`; fuentes OFL embebidas.
