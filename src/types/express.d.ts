import type { AuthenticatedPrincipal } from '../auth/AuthenticatedPrincipal';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedPrincipal;
    }
  }
}

export {};
