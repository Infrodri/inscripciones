# Protocolo de Restauración y Prevención de Inactividad en Supabase (Free Tier)

Este instructivo define el procedimiento operativo estándar para agentes de IA ante proyectos que utilizan Supabase en capa gratuita (Free Tier), contemplando:
1. Restauración integral desde un dump/backup (`.backup.gz` / `.sql`).
2. Configuración de **Keep-Alive autónomo** mediante `pg_cron` para prevenir la pausa automática por inactividad (regla de los 7 días de Supabase).

---

## 1. Detección y Preparación de Conexiones

Obtener las credenciales del nuevo proyecto Supabase:
- **Project Reference ID** (ejemplo: `abcdefghijklmnopqrst`)
- **Database Password** (contraseña de `postgres`)

### Codificación de la Contraseña (URL Encoding)
Si la contraseña contiene caracteres especiales como `@`, `$`, `%`, `#`, `&`, `+`, deben codificarse en percent-encoding para las cadenas de conexión PostgreSQL:
- `@` $\rightarrow$ `%40`
- `$` $\rightarrow$ `%24`
- `#` $\rightarrow$ `%23`
- `+` $\rightarrow$ `%2B`
- `%` $\rightarrow$ `%25`

### Formatos de Conexión
- **Conexión Directa (`DIRECT_URL`)**:
  ```text
  postgresql://postgres:[ENCODED_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
  ```
- **Transaction Pooler (`DATABASE_URL`)**:
  ```text
  postgresql://postgres.[PROJECT_REF]:[ENCODED_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
  ```
- **Session Pooler (IPv4 compatible para clientes de consola como `psql`)**:
  ```text
  postgresql://postgres.[PROJECT_REF]:[ENCODED_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
  ```

---

## 2. Diagnóstico del Archivo de Respaldo

1. **Descompresión:**
   Si el archivo viene en formato `.backup.gz`:
   - Descomprimir con `gzip` o un script Node.js (`zlib.createGunzip()`).
2. **Identificación de Formato:**
   - Si el archivo inicia con números mágicos binarios (`PGDMP`), es formato personalizado: se restaura con `pg_restore`.
   - Si inicia con texto SQL (`-- PostgreSQL database cluster dump` o `-- PostgreSQL database dump`), es texto plano: se procesa y restaura con `psql`.
3. **Manejo de Cluster Dumps (`pg_dumpall`):**
   - Un cluster dump contiene múltiples bases de datos y sentencias de roles globales (`CREATE ROLE`, `\connect template1`, etc.).
   - En Supabase administrado, las sentencias globales y de roles de sistema fallan por falta de permisos de superusuario.
   - **Acción:** Extraer los bloques correspondientes al esquema de la aplicación (`Schema: public;`) junto con sus sentencias `COPY public.<tabla> FROM stdin;` y sentencias `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX`.

---

## 3. Restauración de Datos

Ejecutar la restauración apuntando a la conexión directa o session pooler:

```bash
psql "<CONNECTION_URI>" -f restore_public.sql
```

### Verificación Post-Restauración
Ejecutar un query de conteo sobre las tablas principales de la aplicación para certificar la integridad de los datos cargados:
```sql
SELECT 'events' AS table_name, count(*) FROM events
UNION ALL
SELECT 'users', count(*) FROM users
UNION ALL
SELECT 'participants', count(*) FROM participants;
```

---

## 4. Configuración de Keep-Alive Autónomo (`pg_cron`)

Para evitar que Supabase pause el proyecto tras 7 días sin actividad en el plan gratuito, **no es necesario depender de servicios de terceros**. Supabase incluye nativamente la extensión `pg_cron`.

### Instrucción SQL a Ejecutar
Conectar a la base de datos como usuario `postgres` y ejecutar:

```sql
-- 1. Habilitar la extensión pg_cron en el esquema de extensiones
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Registrar el cron job de actividad periódica (cada 6 horas)
SELECT cron.schedule(
  'keep-alive-frequent',
  '0 */6 * * *',
  'SELECT 1;'
);

-- 3. Verificar que el job quedó activo
SELECT jobid, jobname, schedule, command, active FROM cron.job;
```

### Mecánica del Keep-Alive
- **Frecuencia:** `0 */6 * * *` (se ejecuta cada 6 horas: 00:00, 06:00, 12:00, 18:00 UTC).
- **Costo:** 0 recursos adicionales; corre dentro del motor de PostgreSQL sin dependencias externas.
- **Efecto:** Mantiene viva la base de datos de forma indefinida frente a las políticas de pausa por inactividad.

---

## 5. Actualización de Entornos de Despliegue (Hosting)

Actualizar las variables en el proveedor de alojamiento de la API (Render, Railway, Fly.io, etc.):
1. `DATABASE_URL`: Transaction Pooler (puerto `6543`).
2. `DIRECT_URL`: Conexión directa (puerto `5432`).
3. `SUPABASE_URL`: `https://[PROJECT_REF].supabase.co`
4. `SUPABASE_SERVICE_ROLE_KEY`: Service role secret del nuevo proyecto.
5. Storage Buckets: Verificar en Supabase Storage que existan los buckets que requiere el aplicativo con sus políticas correspondientes (`public` / `private`).
