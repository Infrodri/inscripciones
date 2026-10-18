import path from 'node:path';
import fs from 'node:fs';

// Resuelve la carpeta de fuentes tanto en desarrollo (src/shared) como compilado (dist/src/shared) y en tests.
export function fontPaths(): Record<'sans' | 'serif' | 'script', string> {
  const candidates = [
    process.env.FONTS_DIR,
    path.join(__dirname, '..', '..', 'assets', 'fonts'),
    path.join(__dirname, '..', '..', '..', 'assets', 'fonts'),
    path.resolve(process.cwd(), 'packages', 'api', 'assets', 'fonts'),
    path.resolve(process.cwd(), 'assets', 'fonts'),
  ].filter((c): c is string => Boolean(c));

  const dir =
    candidates.find((d) => fs.existsSync(path.join(d, 'Sans-Regular.ttf'))) ?? candidates[0];

  return {
    sans: path.join(dir, 'Sans-Regular.ttf'),
    serif: path.join(dir, 'Serif-Regular.ttf'),
    script: path.join(dir, 'GreatVibes-Regular.ttf'),
  };
}
