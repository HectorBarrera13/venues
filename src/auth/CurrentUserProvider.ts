import type { Request } from 'express';

export interface MockCurrentUser {
  userId: string;
  name: string;
  role: string;
}

export const MOCK_USERS: MockCurrentUser[] = [
  { userId: 'venue-owner-1', name: 'Alex Morgan', role: 'venue_owner' },
  { userId: 'organizer-1', name: 'Jordan Lee', role: 'organizer' },
];

export class CurrentUserProvider {
  getCurrentUser(req: Request): MockCurrentUser {
    const requestedId = req?.headers?.['x-mock-user'];
    if (typeof requestedId === 'string') {
      const found = MOCK_USERS.find((user) => user.userId === requestedId);
      if (found) return found;
    }
    return MOCK_USERS[0];
  }
}

export const currentUserProvider = new CurrentUserProvider();
