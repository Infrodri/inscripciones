import { describe, expect, it, vi } from 'vitest';
import { apiErrorMessage, clearToken, getToken, handleUnauthorized, setToken } from '../lib/api';

describe('lib/api', () => {
  it('guarda y limpia el token en sessionStorage', () => {
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('401 en ruta de administración limpia la sesión y redirige a /admin/login', () => {
    setToken('abc');
    window.history.pushState({}, '', '/admin/eventos');
    const redirect = vi.fn();
    handleUnauthorized(redirect);
    expect(getToken()).toBeNull();
    expect(redirect).toHaveBeenCalledWith('/admin/login');
  });

  it('401 en el portal público limpia la sesión sin redirigir al login', () => {
    setToken('abc');
    window.history.pushState({}, '', '/');
    const redirect = vi.fn();
    handleUnauthorized(redirect);
    expect(getToken()).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('extrae el mensaje en español del envelope', () => {
    const error = {
      response: { data: { error: { message: 'El registro ya existe' } } },
      isAxiosError: true,
    };
    expect(apiErrorMessage(error)).toBe('El registro ya existe');
  });

  it('sin respuesta indica fallo de conexión', () => {
    expect(apiErrorMessage({ code: 'ERR_NETWORK', isAxiosError: true })).toBe(
      'No se pudo conectar con el servidor'
    );
  });
});
