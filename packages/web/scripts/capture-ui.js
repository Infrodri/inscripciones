const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../docs/ui');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generar token ADMIN
const token = jwt.sign(
  { userId: 'u1', role: 'ADMIN', email: 'admin@usfx.bo' },
  'clave-larga-solo-local-1234567890'
);

const user = {
  id: 'u1',
  email: 'admin@usfx.bo',
  name: 'Administrador USFX',
  role: 'ADMIN',
};

async function run() {
  const browser = await chromium.launch({ headless: true });

  const targets = [
    { name: 'login', path: '/admin/login', requiresAuth: false },
    { name: 'eventos', path: '/admin/eventos', requiresAuth: true },
    {
      name: 'inscritos',
      path: '/admin/eventos/23753f72-72c2-4c75-9771-c4cf2355f578?tab=inscritos',
      requiresAuth: true,
    },
    {
      name: 'certificados',
      path: '/admin/eventos/23753f72-72c2-4c75-9771-c4cf2355f578/certificados',
      requiresAuth: true,
    },
    { name: 'escaner', path: '/admin/escaner', requiresAuth: true },
    { name: 'usuarios', path: '/admin/usuarios', requiresAuth: true },
    { name: 'evento-publico', path: '/e/congreso-derecho-2026', requiresAuth: false },
  ];

  const viewports = [
    { label: '1280', width: 1280, height: 800 },
    { label: '390', width: 390, height: 844 },
  ];

  const errors = [];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    for (const target of targets) {
      const page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.error(`[Console Error on ${target.name} (${vp.label}px)]:`, msg.text());
          errors.push({ target: target.name, vp: vp.label, text: msg.text() });
        }
      });

      page.on('pageerror', (err) => {
        console.error(`[Page Uncaught Error on ${target.name} (${vp.label}px)]:`, err.message);
        errors.push({ target: target.name, vp: vp.label, text: err.message });
      });

      if (target.requiresAuth) {
        // Inicializar sessionStorage antes de cargar
        await page.addInitScript(
          ({ token, user }) => {
            sessionStorage.setItem('inscripciones:token', token);
            sessionStorage.setItem('inscripciones:user', JSON.stringify(user));
          },
          { token, user }
        );
      }

      const url = `http://localhost:3000${target.path}`;
      console.log(`Navigating to ${url} (${vp.width}x${vp.height})...`);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000); // estabilizar rendering

      const outPath = path.join(outDir, `${target.name}-${vp.label}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Captured screenshot: ${outPath}`);
      await page.close();
    }

    await context.close();
  }

  await browser.close();

  console.log('\n--- RESULTADO DE CAPTURAS ---');
  console.log(`Directorio: ${outDir}`);
  console.log(`Total de errores en consola: ${errors.length}`);
  if (errors.length > 0) {
    console.error('Errores encontrados:', errors);
    process.exit(1);
  } else {
    console.log('✓ 0 errores en consola.');
  }
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
