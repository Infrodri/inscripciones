import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FileStorage, StoredFile } from './fileStorage.js';

// Solo Storage; sin consultas de negocio. Bucket público para afiches,
// bucket privado para plantillas (se sirven vía API con JWT ADMIN).
export class SupabaseFileStorage implements FileStorage {
  readonly visibility: 'public' | 'private';
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(
    supabaseUrl: string,
    serviceKey: string,
    bucket: string,
    visibility: 'public' | 'private'
  ) {
    this.client = createClient(supabaseUrl, serviceKey);
    this.bucket = bucket;
    this.visibility = visibility;
  }

  async save(data: Buffer, key: string, contentType: string): Promise<StoredFile> {
    const { error } = await this.client.storage.from(this.bucket).upload(key, data, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`No se pudo guardar el archivo: ${error.message}`);
    return { path: `${this.bucket}/${key}` };
  }

  async read(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) throw new Error('Archivo no encontrado');
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.client.storage.from(this.bucket).remove([key]);
  }
}
