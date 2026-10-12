import { describe, expect, it } from 'vitest';
import { apiUrl, buildApiBaseUrl, configErrorMessage } from '../lib/api';

describe('buildApiBaseUrl', () => {
  it('agrega /api/v1 al host pelado', () => {
    expect(buildApiBaseUrl('http://localhost:3001')).toBe('http://localhost:3001/api/v1');
  });

  it('tolera la barra final', () => {
    expect(buildApiBaseUrl('http://localhost:3001/')).toBe('http://localhost:3001/api/v1');
  });

  it('falla en español si falta la variable', () => {
    expect(() => buildApiBaseUrl(undefined)).toThrowError('Falta configurar NEXT_PUBLIC_API_URL');
    expect(() => buildApiBaseUrl('')).toThrowError('Falta configurar NEXT_PUBLIC_API_URL');
    expect(() => buildApiBaseUrl('   ')).toThrowError('Falta configurar NEXT_PUBLIC_API_URL');
  });
});

describe('apiUrl', () => {
  it('une base y ruta', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/';
    expect(apiUrl('/auth/login')).toBe('http://localhost:3001/api/v1/auth/login');
    expect(apiUrl('public/events/x')).toBe('http://localhost:3001/api/v1/public/events/x');
  });
});

describe('configErrorMessage', () => {
  it('expone el mensaje de configuración', () => {
    expect(configErrorMessage(new Error('Falta configurar NEXT_PUBLIC_API_URL'))).toBe(
      'Falta configurar NEXT_PUBLIC_API_URL'
    );
  });

  it('ignora otros errores', () => {
    expect(configErrorMessage(new Error('otro fallo'))).toBeNull();
    expect(configErrorMessage(null)).toBeNull();
  });
});
