import type { AuthenticatedUser } from '../auth/AuthenticatedUser';
import { AUTH_CONFIG, normalizeRole } from '../auth/authConfig';
import Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import { venueRepository, type VenueStore } from '../repositories/VenueRepository';
import { parseCreateVenue, parseListVenuesQuery } from '../validation/venueInput';

export type VenueUser = AuthenticatedUser;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Paginated list shape shared by every collection endpoint: `{ data, pagination }`. */
export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

/** Prisma reports a unique index violation (including raw MongoDB indexes) as P2002. */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002');
}

function duplicateOsmRef(existing: Venue): ApiError {
  return ApiError.conflict(`A venue with osmRef "${existing.osmRef}" already exists`, {
    existingVenueId: existing.id,
  });
}

export class VenueService {
  constructor(private readonly repository: VenueStore = venueRepository) {}

  async listVenues(rawQuery?: unknown): Promise<Paginated<Venue>> {
    const { page, limit, filters } = parseListVenuesQuery(rawQuery);
    if (Object.keys(filters).length > 0) {
      throw ApiError.notImplemented('Venue search filters are not implemented yet');
    }

    const { items, total } = await this.repository.findPage({ skip: (page - 1) * limit, take: limit });
    return {
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getVenueById(id: string): Promise<Venue> {
    const venue = await this.repository.findById(id);
    if (!venue) {
      throw ApiError.notFound(`Venue "${id}" not found`);
    }
    return venue;
  }

  async venueExists(id: string): Promise<boolean> {
    return Boolean(await this.repository.findById(id));
  }

  async registerVenue(body: unknown, currentUser?: VenueUser): Promise<Venue> {
    const command = parseCreateVenue(body);
    if (!currentUser?.userId || normalizeRole(currentUser.role) !== AUTH_CONFIG.roles.VENUE_OWNER) {
      throw ApiError.forbidden();
    }

    if (command.osmRef) {
      const existing = await this.repository.findByOsmRef(command.osmRef);
      if (existing) throw duplicateOsmRef(existing);
    }

    const venue = new Venue({ ...command, ownerId: currentUser.userId });
    try {
      return await this.repository.save(venue, currentUser.name);
    } catch (error) {
      // Another request registered the same osmRef between the check and the insert.
      const winner = command.osmRef && isUniqueViolation(error)
        ? await this.repository.findByOsmRef(command.osmRef)
        : null;
      if (winner) throw duplicateOsmRef(winner);
      throw error;
    }
  }
}

export const venueService = new VenueService();
