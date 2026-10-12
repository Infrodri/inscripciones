import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/api/env.js';

const base = {
  DATABASE_URL: 'postgresql://x/x',
  JWT_SECRET: 'clave-larga-de-prueba-123',
  CORS_ORIGINS: 'http://localhost:3000',
};

describe('parseEnv', () => {
  it('falla nombrando DATABASE_URL si falta', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: '' } as never)).toThrowError(/DATABASE_URL/);
  });
  it('falla nombrando JWT_SECRET si es corta', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'corta' })).toThrowError(/JWT_SECRET/);
  });
  it('falla si producción usa disk', () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', STORAGE_DRIVER: 'disk' })
    ).toThrowError(/STORAGE_DRIVER/);
  });
  it('exige Supabase con driver supabase', () => {
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: 'supabase' })).toThrowError(/SUPABASE_URL/);
  });
  it('acepta configuración local válida', () => {
    expect(parseEnv({ ...base }).PORT).toBe(3001);
  });
});
