import { createHmac, timingSafeEqual } from 'node:crypto';

// QR de sala: token HMAC-SHA256 derivado de JWT_SECRET con prefijo
// "self-checkin:". Ventana de 45 s; se acepta la actual y la anterior.
// Solo `crypto` de Node, comparación en tiempo constante.
export const SELF_CHECKIN_WINDOW_SECONDS = 45;
const PREFIX = 'self-checkin:';

export function currentWindow(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / SELF_CHECKIN_WINDOW_SECONDS);
}

function sign(secret: string, sessionId: string, window: number): string {
  return createHmac('sha256', secret).update(`${PREFIX}${sessionId}:${window}`).digest('hex');
}

export function issueSelfCheckinToken(
  secret: string,
  sessionId: string,
  nowMs: number = Date.now()
): string {
  const window = currentWindow(nowMs);
  const payload = `${sessionId}:${window}:${sign(secret, sessionId, window)}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function windowEndsAt(window: number): Date {
  return new Date((window + 1) * SELF_CHECKIN_WINDOW_SECONDS * 1000);
}

export function verifySelfCheckinToken(
  secret: string,
  token: string,
  nowMs: number = Date.now()
): { sessionId: string } | null {
  let payload: string;
  try {
    payload = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const [sessionId, windowRaw, signature] = payload.split(':');
  const window = Number(windowRaw);
  if (!sessionId || !Number.isInteger(window) || !signature) return null;
  const now = currentWindow(nowMs);
  if (window !== now && window !== now - 1) return null;
  const expected = sign(secret, sessionId, window);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { sessionId };
}
