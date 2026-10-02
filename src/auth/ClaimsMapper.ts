import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';

export interface ClaimsMapper {
  map(payload: Record<string, unknown>): AuthenticatedPrincipal;
}
