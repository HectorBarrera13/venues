import type Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import {
  venueRepository,
  type VenueSearchHit,
  type VenueStore,
} from '../repositories/VenueRepository';
import {
  parseListVenuesQuery,
  type ListVenuesQuery,
  type VenueSearchFilters,
} from '../validation/venueInput';

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

const GEO_FIELD_ERROR = /"(lat|lng|radius_km)"/;

function parseSearchQuery(rawQuery: unknown): ListVenuesQuery {
  try {
    return parseListVenuesQuery(rawQuery);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      GEO_FIELD_ERROR.test(error.message) &&
      !error.message.includes('must be given together')
    ) {
      throw ApiError.badRequest('Invalid coordinates or radius');
    }
    throw error;
  }
}

function hasActiveFilters(filters: VenueSearchFilters): boolean {
  return Boolean(filters.near || filters.country || filters.city || filters.name);
}

/**
 * Application service for C4 venue detail and C5 venue listing/search.
 * Validates query parameters before touching the venue store and enforces
 * pagination metadata for every response.
 */
export class VenueSearchService {
  constructor(
    private readonly repository: Pick<VenueStore, 'findPage' | 'search' | 'findById'> = venueRepository
  ) {}

  async searchVenues(rawQuery?: unknown): Promise<Paginated<VenueSearchHit>> {
    const { page, limit, filters } = parseSearchQuery(rawQuery);
    const skip = (page - 1) * limit;

    const { items, total } = hasActiveFilters(filters)
      ? await this.repository.search({ skip, take: limit, filters })
      : await this.repository.findPage({ skip, take: limit }).then((result) => ({
          items: result.items.map((venue) => ({ venue })),
          total: result.total,
        }));

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVenueById(id: string): Promise<Venue> {
    const venue = await this.repository.findById(id);
    if (!venue) {
      throw ApiError.notFound(`Venue "${id}" not found`);
    }
    return venue;
  }
}

export const venueSearchService = new VenueSearchService();
