import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileStorage, StoredFile } from './fileStorage.js';

// Adaptador a disco para local. En nube se usa Supabase detrás de la misma interfaz.
// Públicos (afiche): ./uploads/public. Privados (plantillas): ./uploads/private.
export class DiskFileStorage implements FileStorage {
  readonly visibility: 'public' | 'private';
  private readonly baseDir: string;

  constructor(baseDir: string, visibility: 'public' | 'private') {
    this.baseDir = baseDir;
    this.visibility = visibility;
  }

  async save(data: Buffer, key: string, _contentType: string): Promise<StoredFile> {
    const safeKey = key.replace(/\\/g, '/');
    const fullPath = path.join(this.baseDir, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return { path: safeKey };
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.baseDir, key));
  }

  async remove(key: string): Promise<void> {
    await fs.rm(path.join(this.baseDir, key), { force: true });
  }
}
