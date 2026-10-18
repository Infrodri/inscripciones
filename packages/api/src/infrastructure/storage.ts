import path from 'node:path';
import { DiskFileStorage } from '@inscripciones/infrastructure/diskStorage.js';
import { SupabaseFileStorage } from '@inscripciones/infrastructure/supabaseStorage.js';
import type { FileStorage } from '@inscripciones/infrastructure/fileStorage.js';
export type { FileStorage };
import type { AppEnv } from '../api/env.js';

export interface StorageClients {
  publicStorage: FileStorage;
  privateStorage: FileStorage;
}

export function createStorage(env: AppEnv): StorageClients {
  if (env.STORAGE_DRIVER === 'supabase') {
    return {
      publicStorage: new SupabaseFileStorage(
        env.SUPABASE_URL as string,
        env.SUPABASE_SERVICE_ROLE_KEY as string,
        env.SUPABASE_PUBLIC_BUCKET,
        'public'
      ),
      privateStorage: new SupabaseFileStorage(
        env.SUPABASE_URL as string,
        env.SUPABASE_SERVICE_ROLE_KEY as string,
        env.SUPABASE_PRIVATE_BUCKET,
        'private'
      ),
    };
  }
  return {
    publicStorage: new DiskFileStorage(path.join(env.UPLOADS_DIR, 'public'), 'public'),
    privateStorage: new DiskFileStorage(path.join(env.UPLOADS_DIR, 'private'), 'private'),
  };
}
