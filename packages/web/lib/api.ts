import axios from 'axios';
import { clearSession, getToken } from '@/lib/auth';

export {
  clearSession,
  clearToken,
  getSessionUser,
  getToken,
  setSession,
  setToken,
} from '@/lib/auth';
export type { SessionUser } from '@/lib/auth';

export const API_CONFIG_MESSAGE = 'Falta configurar NEXT_PUBLIC_API_URL';

// Contrato: la variable trae SOLO el host (sin /api/v1 ni barra final).
// Ej: http://localhost:3001
export function buildApiBaseUrl(raw: string | undefined): string {
  if (!raw || raw.trim() === '') throw new Error(API_CONFIG_MESSAGE);
  return `${raw.trim().replace(/\/+$/, '')}/api/v1`;
}

let warnedMissing = false;

export function apiBaseUrl(): string {
  try {
    return buildApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  } catch (error) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.error(`${API_CONFIG_MESSAGE} (hosts pelado, ej. http://localhost:3001)`);
    }
    throw error;
  }
}

export function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function configErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.includes('NEXT_PUBLIC_API_URL')) {
    return error.message;
  }
  return null;
}

export const api = axios.create({});

export function handleUnauthorized(
  redirect: (url: string) => void = (url: string): void => {
    window.location.href = url;
  }
): void {
  clearSession();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
    redirect('/admin/login');
  }
}

api.interceptors.request.use((config) => {
  // baseURL aquí (no al crear la instancia): si falta la variable, la
  // petición falla con mensaje claro en vez de ir al origen web.
  config.baseURL = apiBaseUrl();
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
  const configMessage = configErrorMessage(error);
  if (configMessage) return configMessage;
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === 'string' && message !== '') return message;
    if (error.code === 'ERR_NETWORK') return 'No se pudo conectar con el servidor';
  }
  return 'Ocurrió un error inesperado';
}
