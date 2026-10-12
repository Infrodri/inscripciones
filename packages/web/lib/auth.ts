const TOKEN_KEY = 'inscripciones:token';
const USER_KEY = 'inscripciones:user';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

function storage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string): void {
  try {
    storage()?.setItem(TOKEN_KEY, token);
  } catch {
    // Sin almacenamiento: la sesión solo vive en memoria de esta pestaña.
  }
}

export function clearToken(): void {
  try {
    storage()?.removeItem(TOKEN_KEY);
  } catch {
    // Nada que limpiar.
  }
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = storage()?.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (typeof parsed.name !== 'string' || typeof parsed.role !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser): void {
  setToken(token);
  try {
    storage()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Nada que guardar.
  }
}

export function clearSession(): void {
  clearToken();
  try {
    storage()?.removeItem(USER_KEY);
  } catch {
    // Nada que limpiar.
  }
}
