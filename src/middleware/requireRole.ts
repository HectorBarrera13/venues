import type { NextFunction, Request, RequestHandler, Response } from 'express';
import ApiError from '../errors/ApiError';
import { normalizeRole } from '../auth/authConfig';

/**
 * Authorizes an authenticated request against the given roles.
 * Authenticated but not allowed -> 403.
 */
export function requireRole(...allowedRoles: string[]): RequestHandler {
  const allowed = allowedRoles.map(normalizeRole);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }

    const role = normalizeRole(user.role);
    if (!allowed.includes(role)) {
      next(ApiError.forbidden(`Role "${role || 'unknown'}" is not allowed to access this resource`));
      return;
    }

    next();
  };
}

export default requireRole;