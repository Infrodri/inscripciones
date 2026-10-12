# DECISIONS.md — decisiones tomadas durante la construcción

Registro de decisiones con defaults aplicados sin bloquear. Las dudas no bloquean:
se decide con los defaults de la sección 3, se anota aquí y se sigue.

## H1 (cierre)

1. `typescript-eslint@8.71.1` como devDependency raíz (verificado: soporta
   eslint ^8.57 y TS >=4.8.4 <6.1.0). Sin variables de entorno ni `--ext`.
2. `sonner 1.7.4` (la 1.5.0 exige React 18 y rompe `npm install` con React 19).
3. Sin `cors` como dependencia: CORS mínimo implementado a mano en `app.ts`
   (solo el dominio del web). Evita una dependencia nueva.
4. `engines`: `>=22` (decisión 9). `NODE_VERSION` para Render: pendiente de
   verificar la LTS vigente en H4.
5. Token JWT en el cliente en `sessionStorage`, header `Authorization`; ante
   401 se limpia la sesión y se redirige a `/admin/login` (decisión 15).
6. Postgres local en puerto 5434: el 5432 lo ocupa otro proyecto
   (`notaria_local_db`); no se tocan contenedores ajenos.
7. Duplicar evento copia las filas de plantillas compartiendo el archivo
   privado (no se duplica el binario); no copia inscritos, asistencias ni
   receptores manuales.
8. `GET /health` responde `{ok:true}` 200 / `{ok:false}` 503 plano: es probe
   de infraestructura, fuera del envelope de errores de negocio.
9. `z.string().datetime({ offset: true })` en sesiones para aceptar `-04:00`
   (el default de zod solo acepta `Z`).
10. `@inscripciones/infrastructure` expone `exports` `./*.js` → `dist`
    (requerido por `moduleResolution: NodeNext` para imports profundos).

## H2

11. Rutas públicas bajo `/api/v1/public` con rate limit propio; honeypot
    `website` devuelve 201 falso sin crear nada.
12. Cupo resistente a carreras: `SELECT … FOR UPDATE` sobre el evento dentro
    de la transacción + únicos de BD + captura de P2002.
13. Correo fail-soft (decisión 11 del plan): `mailSent` + aviso en español, sin
    colas; el QR siempre queda en pantalla.
14. Exportaciones solo ADMIN: `exceljs` para xlsx, CSV manual con BOM.
15. Listado de inscritos legible por ADMIN y STAFF (STAFF lo usa en puerta, H3).
16. URLs absolutas de afiche/QR vía `API_PUBLIC_URL`; en Supabase, URL pública
    del objeto. `og:image` sale del API, la web solo la usa.
17. Sin `@hookform/resolvers`: validación zod manual (`safeParse` → `setError`)
    para no agregar dependencias.
18. Arranque del API compilado: `node dist/src/api/app.js` (rootDir ".").

## H3

19. Puerta sin control de estado del evento (el staff decide); sí exige
    ventana de sesión y genera duplicados por P2002.
20. Porcentaje y aptos por consulta en `/stats`; nada se almacena.
21. Anular conserva la fila + `audit_logs`; solo ADMIN con motivo.
22. `html5-qrcode` con `next/dynamic` (`ssr: false`); el lector se detiene al
    registrar y hay búsqueda manual de respaldo.
23. `GET /sessions/:id` (ADMIN/STAFF) para datos de la pantalla de scan.

## H4

24. `render.yaml` compila desde la RAÍZ (workspaces necesitan el lock raíz);
    `migrate deploy` antes de iniciar; `NODE_VERSION=24` (LTS vigente).
25. Smoke recibe la BASE del servicio (`/health` vive en raíz); no crea datos
    en producción (el registro con borrado se verifica en staging).
26. `scripts/smoke.ts` corre con node directo (type stripping, sin enums);
    `process.exitCode` en vez de `process.exit` (evita un assert de libuv en
    Windows).

## H5

27. `@types/pdfkit@0.17.6` (tipos del stack, sin runtime nuevo).
28. Helpers puros de certificado en `infrastructure/certificates.ts`; la API
    re-exporta (infrastructure nunca importa de api).
29. `requireRole` siempre POR RUTA: ni `app.use` ni `router.use` sirven con
    routers montados en la misma base, porque rechazan el STAFF de rutas
    montadas después aunque no coincidan (fallo real en H3: walk-in/stats).
30. Cabecera de reporte PDF por log (`logger.info certificates_exported`):
    no se puede fijar header después del streaming.
31. Duplicar plantilla comparte el archivo privado (igual que el evento).

## H6

32. Receptores: `note` es referencia interna (cargo/observación), nunca se
    imprime; `bulk` reporta creados/duplicados; `from-speakers` usa la
    default de EXPOSITOR y omite existentes sin fallar.

## H7

33. Organizadores reutiliza el mismo formulario y `bulk` que expositores;
    cada variante de firma es una plantilla propia del rol ORGANIZADOR.

## H8

34. Los tests resuelven `@inscripciones/infrastructure` vía `exports` →
    `dist`: hay que reconstruir infrastructure tras cambiarla
    (`npm run build` lo hace en orden).
35. Sin sesiones, la lista sale como página general única.

## Prod

36. `postinstall` + `build` generan el cliente Prisma: sin esto, clon limpio
    falla (tipos vacíos → implicit any + imports rotos). Verificado en clon
    temporal: `npm ci` → `npm run build` → `npm test` 57/57.
37. `render.yaml` ya generaba Prisma y construía infrastructure antes que api;
    la web no importa infrastructure en runtime (solo transpilePackages).

## Prod (tareas)

38. Vercel: Root `packages/web` + fuera-de-raíz incluido + `cd ../..`
    en install/build (fijado en `packages/web/vercel.json`).
39. Web tests: `jsdom@30.1.2` + `@testing-library/react@16.3.3` (únicas
    dependencias nuevas; sin ellas no hay DOM ni render de componentes).
    `vitest` reutiliza la versión del repo. `esbuild.jsx automatic` en la
    config de web porque el tsconfig usa `preserve` (Next).
40. Check-in: `qr_token` tiene índice único (`participants_qr_token_key`);
    el Seq Scan del EXPLAIN es decisión del planificador con tabla pequeña.
    Búsqueda manual con `take: 10`. Medido local: 50 check-ins, total 307ms,
    promedio 6.1ms, p95 9ms.

## QR rápido (formulario + sala)

41. Email nullable con único parcial natural (NULLs no colisionan en PG);
    teléfono opcional normalizado a `+591XXXXXXXX` (acepta +591/591/espacios/
    guiones; exige 8 dígitos desde 6 o 7); CI `^[A-Z0-9]{5,15}$` validado con
    trim en zod y mayúsculas en `normalizeCi`. Tests viejos adaptados a CI
    sin guiones.
42. `require_*` = exigir (siempre visibles). Sin correo no hay mail y el
    éxito avisa "No indicaste correo…".
43. Token de sala HMAC-SHA256(`JWT_SECRET`, `self-checkin:{session}:{ventana}`)
    base64url, ventana 45 s (actual + anterior), `timingSafeEqual`, solo
    `crypto`. Respuesta abreviada "Ana P.", sin PII.
44. Límites: 60/min por IP en rutas de sala (montadas antes del limitador
    general de 30/min) + 5 fallos por token+CI cada 10 min en memoria
    (códigos `RATE_LIMITED` 429 y `NOT_ENROLLED` 404 nuevos).
45. Limitación conocida: alguien presente podría teclear el CI de otro
    inscrito; se acepta para el evento (mitiga: ventana de 45 s + registro
    abierto solo durante la sesión + auditoría open/close).
