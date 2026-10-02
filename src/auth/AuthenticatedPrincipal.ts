export interface AuthenticatedPrincipal {
  userId: string;
  roles: readonly string[];
}
