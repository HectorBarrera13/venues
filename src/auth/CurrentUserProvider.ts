import type { Request } from 'express';
import { MOCK_USERS, getUserById, type MockUser } from '../../shared/mocks';

export interface CurrentUser {
  userId: string;
  name: string;
  role: string;
}

/**
 * CurrentUserProvider — Legacy Development Adapter
 *
 * Sourced solely from shared/mocks (single source of truth).
 * Kept strictly for backward compatibility in local development helpers.
 * Never used for production authentication.
 */
export class CurrentUserProvider {
  getCurrentUser(req: Request): CurrentUser {
    const header = req?.headers?.['x-mock-user'];
    const requestedId = Array.isArray(header) ? header[0] : header;
    if (requestedId) {
      const found = getUserById(requestedId);
      if (found) {
        return {
          userId: found.userId,
          name: found.name,
          role: found.role,
        };
      }
    }
    const fallback: MockUser = MOCK_USERS[0];
    return {
      userId: fallback.userId,
      name: fallback.name,
      role: fallback.role,
    };
  }
}

export const currentUserProvider = new CurrentUserProvider();
export default currentUserProvider;