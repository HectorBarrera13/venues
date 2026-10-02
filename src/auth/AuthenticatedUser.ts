/**
 * Identity resolved from a verified access token.
 * Only `userId` and `role` are guaranteed by the verifier.
 */
export interface AuthenticatedUser {
  userId?: string;
  /** Legacy alias of {@link AuthenticatedUser.userId} kept for older callers. */
  id?: string;
  name?: string;
  role?: string;
}