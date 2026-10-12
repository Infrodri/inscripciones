import axios from 'axios';

const TOKEN_KEY = 'inscripciones:token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Sin almacenamiento: la sesión solo vive en memoria de esta pestaña.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nada que limpiar.
  }
}

export const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

export function handleUnauthorized(
  redirect: (url: string) => void = (url: string): void => {
    window.location.href = url;
  }
): void {
  clearToken();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
    redirect('/admin/login');
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) handleUnauthorized();
    return Promise.reject(error);
  }
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === 'string' && message !== '') return message;
    if (error.code === 'ERR_NETWORK') return 'No se pudo conectar con el servidor';
  }
  return 'Ocurrió un error inesperado';
}
