import type { AuthenticatedPrincipal } from '../auth/AuthenticatedPrincipal';
import { Roles } from '../auth/roles';
import Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import { venueRepository, type VenueStore } from '../repositories/VenueRepository';

export interface CreateVenueInput {
  name?: string;
  description?: string;
  location?: string;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `Field "${field}" is required`);
  }
  return value.trim();
}

export class VenueService {
  constructor(private readonly repository: VenueStore = venueRepository) {}

  async listVenues(): Promise<Venue[]> {
    return this.repository.findAll();
  }

  async registerVenue(data: CreateVenueInput | undefined, principal?: AuthenticatedPrincipal): Promise<Venue> {
    const name = requiredText(data?.name, 'name');
    const description = requiredText(data?.description, 'description');
    const location = requiredText(data?.location, 'location');
    if (!principal || !principal.roles || !principal.roles.includes(Roles.VENUE_OWNER)) {
      throw ApiError.forbidden();
    }
    const venue = new Venue(name, description, location, principal.userId);
    return this.repository.save(venue);
  }
}

export const venueService = new VenueService();
