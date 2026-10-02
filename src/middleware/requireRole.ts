import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function requireRole(role: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.auth.roles || !req.auth.roles.includes(role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    return next();
  };
}
