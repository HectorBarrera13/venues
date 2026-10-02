import ApiError from '../errors/ApiError';

/**
 * Single source of truth for the access-token contract shared with the Auth service.
 * Claim names, role values, algorithm and secret location are defined here only,
 * so adapting to the real auth provider is a one-file change.
 */
export const AUTH_CONFIG = {
  secretEnvVar: 'JWT_SECRET',
  algorithm: 'HS256',
  claims: {
    subject: 'sub',
    role: 'role',
    expiresAt: 'exp',
    name: 'name',
  },
  roles: {
    VENUE_OWNER: 'VENUE_OWNER',
    ORGANIZER: 'ORGANIZER',
  },
} as const;

/** Roles accepted on every venue endpoint. */
export const PARTNER_ROLES: readonly string[] = Object.values(AUTH_CONFIG.roles);

/** Compares roles case-insensitively so cosmetic differences are not fatal. */
export function normalizeRole(role: unknown): string {
  return typeof role === 'string' ? role.trim().toUpperCase() : '';
}

/** Reads the signing secret from the environment. Never hardcoded. */
export function getJwtSecret(): string {
  const secret = process.env[AUTH_CONFIG.secretEnvVar];
  if (!secret || !secret.trim()) {
    throw ApiError.internal(`${AUTH_CONFIG.secretEnvVar} environment variable is not configured`);
  }
  return secret;
}

export default AUTH_CONFIG;