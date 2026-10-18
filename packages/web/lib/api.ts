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
  if (typeof window !== 'undefined') {
    // NUNCA redirigir al login si el usuario está en el portal público (/ o /e/...)
    const isPublic = window.location.pathname === '/' || window.location.pathname.startsWith('/e/');
    if (isPublic) {
      return;
    }
    if (!window.location.pathname.startsWith('/admin/login')) {
      redirect('/admin/login');
    }
  }
}

api.interceptors.request.use((config) => {
  // baseURL aquí (no al crear la instancia): si falta la variable, la
  // petición falla con mensaje claro en vez de ir al origen web.
  config.baseURL = apiBaseUrl();
  // Evitar duplicar prefijo si el caller pasó una URL relativa que ya incluye /api/v1
  if (config.url && config.url.startsWith('/api/v1/')) {
    config.url = config.url.replace(/^\/api\/v1/, '');
  }
  const token = getToken();
  // No enviar Bearer token a endpoints públicos para evitar 401 por sesión expirada
  const isPublicUrl =
    config.url && (config.url.startsWith('/public') || config.url.includes('/public/'));
  if (token && !isPublicUrl) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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
    const code = error.response?.data?.error?.code;
    const message = error.response?.data?.error?.message;
    const details = error.response?.data?.error?.details;
    if (code === 'NO_DEFAULT_TEMPLATE') {
      return typeof message === 'string' && message !== ''
        ? message
        : 'No hay una plantilla predeterminada configurada para este rol. Súbala o configúrela en la pestaña Plantillas.';
    }
    if (code === 'NO_PARTICIPANTS') {
      return typeof message === 'string' && message !== ''
        ? message
        : 'No hay participantes registrados para generar este documento.';
    }
    if (Array.isArray(details) && details.length > 0) {
      const firstIssue = details[0] as { path?: unknown[]; message?: string };
      const issuePath = Array.isArray(firstIssue?.path) ? firstIssue.path.join('.') : '';
      const issueMsg = firstIssue?.message || '';
      if (issueMsg) {
        return issuePath
          ? `${message || 'Error de validación'}: ${issuePath} (${issueMsg})`
          : `${message || 'Error de validación'}: ${issueMsg}`;
      }
    }
    if (typeof message === 'string' && message !== '') return message;
    if (error.code === 'ERR_NETWORK') return 'No se pudo conectar con el servidor';
  }
  return 'Ocurrió un error inesperado';
}
