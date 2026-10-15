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
