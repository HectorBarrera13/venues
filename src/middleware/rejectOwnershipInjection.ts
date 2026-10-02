import type { Request, Response, NextFunction } from 'express';

export function rejectOwnershipInjection(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    if ('ownerId' in req.body || 'authorId' in req.body) {
      res.status(400).json({ error: 'Injecting ownerId or authorId is not allowed' });
      return;
    }
  }
  return next();
}
