import type { AuthenticatedUser } from '../auth/AuthenticatedUser';
import { AUTH_CONFIG, normalizeRole } from '../auth/authConfig';
import Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import { venueRepository, type VenueStore } from '../repositories/VenueRepository';
import { parseCreateVenue } from '../validation/venueInput';
import { VenueSearchService, type Paginated, type Pagination } from './VenueSearchService';

export type VenueUser = AuthenticatedUser;
export type { Paginated, Pagination };

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
  private readonly searchService: VenueSearchService;

  constructor(private readonly repository: VenueStore = venueRepository) {
    this.searchService = new VenueSearchService(repository);
  }

  async listVenues(rawQuery?: unknown): Promise<Paginated<Venue>> {
    const { data, pagination } = await this.searchService.searchVenues(rawQuery);
    return {
      data: data.map((hit) => hit.venue),
      pagination,
    };
  }

  async getVenueById(id: string): Promise<Venue> {
    return this.searchService.getVenueById(id);
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
