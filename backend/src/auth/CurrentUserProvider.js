/**
 * Mock user catalogue.
 * One venue_owner and one organizer so both roles can be tested via
 * the x-mock-user request header without touching anything else.
 *
 * Task 19 will centralise these into a shared package used by both
 * CurrentUserProvider (backend) and CurrentUserService (frontend).
 */
const MOCK_USERS = [
  { userId: 'venue-owner-1', name: 'Alex Morgan', role: 'venue_owner' },
  { userId: 'organizer-1',   name: 'Jordan Lee',  role: 'organizer'   },
];

/**
 * CurrentUserProvider — Auth Placeholder (Task 3)
 *
 * Single source of truth for the authenticated user on every request.
 * All backend code must go through this class; swapping real auth later
 * means only changing this file.
 *
 * Resolution order:
 *   1. x-mock-user header → look up userId in MOCK_USERS
 *   2. Fallback → first entry in MOCK_USERS (venue_owner)
 */
class CurrentUserProvider {
  /**
   * Return the simulated current user for the given request.
   *
   * @param {import('express').Request} req
   * @returns {{ userId: string, name: string, role: string }}
   */
  getCurrentUser(req) {
    const requestedId = req?.headers?.['x-mock-user'];
    if (requestedId) {
      const found = MOCK_USERS.find((u) => u.userId === requestedId);
      if (found) return found;
    }
    return MOCK_USERS[0]; // default: venue_owner
  }
}

const currentUserProvider = new CurrentUserProvider();

module.exports = { CurrentUserProvider, currentUserProvider, MOCK_USERS };
