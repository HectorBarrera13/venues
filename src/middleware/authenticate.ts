import type { NextFunction, Request, RequestHandler, Response } from 'express';
import ApiError from '../errors/ApiError';
import { verifyAccessToken } from '../auth/jwtVerifier';

/**
 * Reads `Authorization: Bearer <token>`.
 */
export function extractBearerToken(header: string | undefined): string {
  if (!header) {
    throw ApiError.unauthorized('Missing Authorization header');
  }

  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || rest.length === 0) {
    throw ApiError.unauthorized('Authorization header must use the Bearer scheme');
  }

  return rest.join(' ');
}

/**
 * Authenticates the request from the verified token. Missing, malformed, tampered
 * and expired tokens are rejected with 401 before any handler runs.
 */
export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.user = verifyAccessToken(extractBearerToken(req.headers.authorization));
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;