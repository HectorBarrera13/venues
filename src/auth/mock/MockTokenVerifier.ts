import ApiError from '../../errors/ApiError';
import { getUserById } from '../../../shared/mocks';
import type { AuthenticatedPrincipal } from '../AuthenticatedPrincipal';
import { Roles } from '../roles';
import type { TokenVerifier } from '../TokenVerifier';

export class MockTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthenticatedPrincipal> {
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw ApiError.unauthorized('Mock token is missing or empty');
    }

    const trimmed = token.trim();
    const user = getUserById(trimmed);
    if (!user) {
      throw ApiError.unauthorized(`Unknown mock user: ${trimmed}`);
    }

    // Normalize mock user role to canonical Roles
    let role = user.role.toUpperCase();
    if (role === 'VENUE_OWNER') {
      role = Roles.VENUE_OWNER;
    } else if (role === 'ORGANIZER') {
      role = Roles.ORGANIZER;
    }

    return {
      userId: user.userId,
      roles: Object.freeze([role]),
    };
  }
}
