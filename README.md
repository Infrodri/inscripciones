# Inscripciones — plataforma de eventos académicos

## Requisitos

- Node 25 (`.nvmrc`), npm 10, Docker.

## Desarrollo local

```bash
docker compose up -d
cp .env.example .env
npm install
npm run test -w packages/api
npm run dev
```

- Web: http://localhost:3000 · API: http://localhost:3001 (`/health`).

## Base de datos

```bash
npm run prisma:generate -w packages/api
npm run prisma:migrate -w packages/api
npm run seed -w packages/api
```

Todo en `timestamptz` (UTC); America/La_Paz solo en presentación.

## Variables de entorno

Ver `.env.example`. Afiches = bucket/carpeta pública (og:image). Plantillas = privada, solo vía API con JWT ADMIN.

## Fuentes de certificados

`packages/api/assets/fonts/`: Inter (sans), Merriweather (serif), Great Vibes (script), todas SIL Open Font License 1.1, con tildes y ñ. Detalle en `packages/api/assets/fonts/README.md`.
