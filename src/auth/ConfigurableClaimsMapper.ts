import ApiError from '../errors/ApiError';
import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';
import type { ClaimsMapper } from './ClaimsMapper';

export interface ClaimsMapperOptions {
  userIdClaim?: string;
  rolesClaim?: string;
}

export class ConfigurableClaimsMapper implements ClaimsMapper {
  private readonly userIdClaim: string;
  private readonly rolesClaim: string;

  constructor(options: ClaimsMapperOptions = {}) {
    this.userIdClaim = options.userIdClaim || 'sub';
    this.rolesClaim = options.rolesClaim || 'roles';
  }

  map(payload: Record<string, unknown>): AuthenticatedPrincipal {
    if (!payload || typeof payload !== 'object') {
      throw ApiError.unauthorized('Invalid token payload');
    }

    const rawUserId = payload[this.userIdClaim];
    if (typeof rawUserId !== 'string' || !rawUserId.trim()) {
      throw ApiError.unauthorized(`User ID claim "${this.userIdClaim}" is missing or invalid`);
    }

    const rawRoles = payload[this.rolesClaim];
    if (rawRoles === undefined || rawRoles === null) {
      throw ApiError.unauthorized(`Roles claim "${this.rolesClaim}" is missing`);
    }

    let normalizedRoles: string[];

    if (Array.isArray(rawRoles)) {
      if (rawRoles.length === 0) {
        throw ApiError.unauthorized(`Roles claim "${this.rolesClaim}" cannot be empty`);
      }
      for (const item of rawRoles) {
        if (typeof item !== 'string' || !item.trim()) {
          throw ApiError.unauthorized(`Roles claim "${this.rolesClaim}" contains invalid role format`);
        }
      }
      normalizedRoles = rawRoles.map((r) => String(r).toUpperCase().trim());
    } else if (typeof rawRoles === 'string') {
      if (!rawRoles.trim()) {
        throw ApiError.unauthorized(`Roles claim "${this.rolesClaim}" cannot be empty`);
      }
      normalizedRoles = [rawRoles.toUpperCase().trim()];
    } else {
      throw ApiError.unauthorized(`Roles claim "${this.rolesClaim}" has an invalid format`);
    }

    return {
      userId: rawUserId.trim(),
      roles: Object.freeze(normalizedRoles),
    };
  }
}
