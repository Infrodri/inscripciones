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
