import path from 'node:path';

// En compilado (dist/src/shared) sube 4 niveles a la raíz del paquete api.
// En tests se usa FONTS_DIR (ver tests/setup.ts).
export function fontPaths(): Record<'sans' | 'serif' | 'script', string> {
  const dir =
    process.env.FONTS_DIR ?? path.join(__dirname, '..', '..', '..', '..', 'assets', 'fonts');
  return {
    sans: path.join(dir, 'Sans-Regular.ttf'),
    serif: path.join(dir, 'Serif-Regular.ttf'),
    script: path.join(dir, 'GreatVibes-Regular.ttf'),
  };
}
