import type { Request } from 'express';
import type { VenueUser } from '../services/VenueService';

export interface ICurrentUserProvider {
  getCurrentUser(req: Request): VenueUser | undefined;
}

export class StubCurrentUserProvider implements ICurrentUserProvider {
  private readonly fixed: VenueUser = {
    userId: 'stub-owner-1',
    name: 'Stub Owner',
    role: 'venue_owner',
  };

  getCurrentUser(req: Request): VenueUser {
    const userId = req.headers['x-user-id'] as string | undefined;
    const role = req.headers['x-user-role'] as string | undefined;
    const name = req.headers['x-user-name'] as string | undefined;

    if (userId) {
      return { userId, role, name };
    }

    return this.fixed;
  }
}

export const currentUserProvider: ICurrentUserProvider = new StubCurrentUserProvider();
