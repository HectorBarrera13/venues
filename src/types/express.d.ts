import type { AuthenticatedUser } from '../auth/AuthenticatedUser';

declare global {
  namespace Express {
    interface Request {
      /** Identity resolved from a verified access token. */
      user?: AuthenticatedUser;
    }
  }
}

export {};