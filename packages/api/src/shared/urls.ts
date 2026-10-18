export interface PublicUrlEnv {
  STORAGE_DRIVER: 'disk' | 'supabase';
  API_PUBLIC_URL: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLIC_BUCKET: string;
}

export function bannerPublicUrl(env: PublicUrlEnv, key: string): string {
  if (env.STORAGE_DRIVER === 'supabase') {
    return `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_PUBLIC_BUCKET}/${key}`;
  }
  return `${env.API_PUBLIC_URL}/uploads/${key}`;
}

export const filePublicUrl = bannerPublicUrl;

export function qrPngUrl(env: PublicUrlEnv, qrToken: string): string {
  return `${env.API_PUBLIC_URL}/api/v1/public/registrations/${qrToken}/qr.png`;
}

export function resolveOrigin(
  req: { query?: Record<string, unknown>; headers?: Record<string, unknown> },
  fallback: string
): string {
  const queryOrigin = typeof req.query?.origin === 'string' ? req.query.origin.trim() : '';
  const headerOrigin =
    typeof req.headers?.['origin'] === 'string' ? req.headers['origin'].trim() : '';
  const headerReferer =
    typeof req.headers?.['referer'] === 'string' ? req.headers['referer'].trim() : '';

  for (const candidate of [queryOrigin, headerOrigin, headerReferer]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // not a valid URL, ignore
    }
  }

  return fallback.replace(/\/+$/, '');
}

