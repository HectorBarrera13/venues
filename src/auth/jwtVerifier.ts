import jwt from 'jsonwebtoken';
import ApiError from '../errors/ApiError';
import type { AuthenticatedUser } from './AuthenticatedUser';
import { AUTH_CONFIG, getJwtSecret } from './authConfig';

function readClaim(payload: jwt.JwtPayload, claim: string): unknown {
  return payload[claim];
}

/**
 * Verifies signature, algorithm and expiration of a bearer token and projects it
 * into the application identity. Any failure surfaces as 401.
 */
export function verifyAccessToken(token: string): AuthenticatedUser {
  const secret = getJwtSecret();
  const { claims } = AUTH_CONFIG;

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: [AUTH_CONFIG.algorithm],
    }) as jwt.JwtPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const userId = readClaim(payload, claims.subject);
  if (typeof userId !== 'string' || !userId.trim()) {
    throw ApiError.unauthorized(`Token is missing the "${claims.subject}" claim`);
  }

  const role = readClaim(payload, claims.role);
  if (typeof role !== 'string' || !role.trim()) {
    throw ApiError.unauthorized(`Token is missing the "${claims.role}" claim`);
  }

  const user: AuthenticatedUser = { userId: userId.trim(), role: role.trim() };
  const name = readClaim(payload, claims.name);
  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }

  return user;
}

export default verifyAccessToken;