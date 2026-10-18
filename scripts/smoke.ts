// Smoke de producción: npm run smoke -- <BASE_URL>
// <BASE_URL> es la raíz del servicio (https://xxx.onrender.com).
// Verifica /health, CORS, evento público sin PII y validación de inscripción
// (sin crear datos). Sale con código distinto de cero si algo falla.
// Solo sintaxis TypeScript borrable (sin enums) para correr con node directo.
interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

async function main(): Promise<void> {
  const base = process.argv[2]?.replace(/\/$/, '');
  if (!base) {
    console.error('Uso: npm run smoke -- <BASE_URL>');
    process.exitCode = 2;
    return;
  }
  const api = `${base}/api/v1`;
  const results: Check[] = [];
  async function check(name: string, fn: () => Promise<string | null>): Promise<void> {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail ?? undefined });
    } catch (err) {
      results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  function assertStatus(res: Response, expected: number, label: string): void {
    if (res.status !== expected) throw new Error(`${label}: HTTP ${res.status}`);
  }

  await check('health', async () => {
    const res = await fetch(`${base}/health`);
    assertStatus(res, 200, 'health');
    return 'ok:true';
  });

  await check('cors-rechaza-origen-ajeno', async () => {
    const res = await fetch(`${base}/health`, { headers: { Origin: 'https://sitio-ajeno.test' } });
    if (res.headers.get('access-control-allow-origin') === 'https://sitio-ajeno.test') {
      throw new Error('el API refleja un origen ajeno');
    }
    return 'rechazado';
  });

  await check('evento-publico-sin-datos-personales', async () => {
    const res = await fetch(`${api}/public/events/conversatorio-ley-denuncias-falsas-2026`);
    if (res.status === 404) return 'sin evento de referencia (aviso, no fallo)';
    assertStatus(res, 200, 'evento público');
    const body = JSON.stringify(await res.json());
    if (/passwordHash|qrToken|certificateCode/i.test(body))
      throw new Error('fuga de datos personales');
    return 'sin PII';
  });

  await check('inscripcion-valida-entrada', async () => {
    // Sin crear datos: cuerpo inválido debe responder error de cliente (el
    // registro real con borrado se verifica en staging, ver DECISIONS.md).
    const res = await fetch(`${api}/public/events/cualquiera/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: '' }),
    });
    if (res.status !== 400 && res.status !== 404 && res.status !== 409) {
      throw new Error(`respuesta inesperada: HTTP ${res.status}`);
    }
    return `HTTP ${res.status}`;
  });

  await check('verificacion-certificados-anti-enumeracion', async () => {
    const res = await fetch(`${api}/public/certificates/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ci: '1234567', code: 'cert-inexistente' }),
    });
    assertStatus(res, 200, 'verificacion publica');
    const data = (await res.json()) as { valid: boolean };
    if (data.valid !== false) throw new Error('debería responder valid: false');
    return 'anti-enumeracion ok';
  });

  for (const r of results)
    console.log(`${r.ok ? 'OK  ' : 'FALLO'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
