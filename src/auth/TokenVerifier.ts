import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}
