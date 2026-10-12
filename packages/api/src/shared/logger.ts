// Logs estructurados JSON. Nunca registrar datos personales (CI, correo,
// celular), secretos, contraseñas ni tokens: pasar solo identificadores.
const SENSITIVE = ['password', 'passwordhash', 'token', 'secret', 'authorization', 'smtppass'];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE.includes(key.toLowerCase()) ? '[redacted]' : redact(item);
    }
    return out;
  }
  return value;
}

function log(level: string, message: string, meta: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...(redact(meta) as Record<string, unknown>),
    })
  );
}

export const logger = {
  info: (message: string, meta: Record<string, unknown> = {}): void => log('info', message, meta),
  warn: (message: string, meta: Record<string, unknown> = {}): void => log('warn', message, meta),
  error: (message: string, meta: Record<string, unknown> = {}): void => log('error', message, meta),
};
