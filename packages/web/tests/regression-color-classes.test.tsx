import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const UI_COMPONENTS_DIR = join(__dirname, '../components/ui');

function getTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

describe('Regresión: clases de color conflictivas en components/ui', () => {
  const tsxFiles = getTsxFiles(UI_COMPONENTS_DIR);

  it('no debe haber elementos con text-white y bg-white en el mismo className', () => {
    const violations: string[] = [];

    for (const file of tsxFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, lineNum) => {
        // Buscar className que contenga tanto text-white como bg-white
        const classNameMatches = line.match(/className\s*=\s*[`"']([^`"']*)[`"']/g);
        if (classNameMatches) {
          for (const match of classNameMatches) {
            const className = match.match(/[`"']([^`"']*)[`"']/)?.[1] || '';
            if (className.includes('text-white') && className.includes('bg-white')) {
              violations.push(`${file}:${lineNum + 1}: text-white + bg-white en className`);
            }
          }
        }

        // Buscar dos clases text-* de color diferentes sin pasar por cn()
        const textColorClasses = line.match(
          /text-(white|black|gray|red|blue|green|yellow|purple|pink|indigo|orange|teal|cyan|emerald|rose|amber|lime|sky|violet|fuchsia|slate|zinc|neutral|stone)-\d+/g
        );
        if (textColorClasses && textColorClasses.length > 1) {
          const uniqueColors = [...new Set(textColorClasses)];
          if (uniqueColors.length > 1 && !line.includes('cn(')) {
            violations.push(
              `${file}:${lineNum + 1}: múltiples text-* sin cn(): ${uniqueColors.join(', ')}`
            );
          }
        }
      });
    }

    if (violations.length > 0) {
      // console.log('Violaciones encontradas:', violations.join('\n'));
    }

    expect(violations).toHaveLength(0);
  });
});
