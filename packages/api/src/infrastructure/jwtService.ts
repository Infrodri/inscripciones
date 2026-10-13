import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'STAFF';
}

export function signAccessToken(payload: JwtPayload, secret: string, expiresIn = '24h'): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
