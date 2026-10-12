import { describe, expect, it } from 'vitest';
import { toScanResult } from '../lib/scan';
import { cameraErrorMessage } from '../components/QrScanner';

describe('toScanResult', () => {
  it('verde con nombre en éxito', () => {
    expect(toScanResult({ firstName: 'Ana', lastName: 'Pérez' }, null)).toEqual({
      kind: 'ok',
      name: 'Ana Pérez',
    });
  });

  it('ámbar con mensaje previo en duplicado', () => {
    expect(toScanResult(null, { code: 'ALREADY_CHECKED_IN', message: 'Ya se registró…' })).toEqual({
      kind: 'dup',
      name: 'Ya se registró…',
    });
  });

  it('rojo con mensaje en QR inválido', () => {
    expect(
      toScanResult(null, { code: 'INVALID_QR', message: 'El código QR no es válido' })
    ).toEqual({
      kind: 'error',
      message: 'El código QR no es válido',
    });
  });
});

describe('cameraErrorMessage', () => {
  it('permiso denegado en español', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/Permiso de cámara denegado/);
  });

  it('sin cámara trasera sugiere la búsqueda manual', () => {
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/búsqueda manual/);
  });
});
