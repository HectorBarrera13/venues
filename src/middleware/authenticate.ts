import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { TokenVerifier } from '../auth/TokenVerifier';

export function createAuthenticate(verifier: TokenVerifier): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Authorization header must use Bearer scheme' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Bearer token is missing or empty' });
      return;
    }

    try {
      const principal = await verifier.verify(token);
      req.auth = principal;
      return next();
    } catch (error) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      const message = error instanceof Error ? error.message : 'Unauthorized';
      res.status(401).json({ error: message });
      return;
    }
  };
}
