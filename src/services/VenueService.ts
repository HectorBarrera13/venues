import type { AuthenticatedUser } from '../auth/AuthenticatedUser';
import { AUTH_CONFIG, normalizeRole } from '../auth/authConfig';
import Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import { venueRepository, type VenueStore } from '../repositories/VenueRepository';

export interface CreateVenueInput {
  name?: string;
  description?: string;
  location?: string;
}

export type VenueUser = AuthenticatedUser;

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

  async registerVenue(data: CreateVenueInput | undefined, currentUser?: VenueUser): Promise<Venue> {
    const name = requiredText(data?.name, 'name');
    const description = requiredText(data?.description, 'description');
    const location = requiredText(data?.location, 'location');
    if (!currentUser?.userId || normalizeRole(currentUser.role) !== AUTH_CONFIG.roles.VENUE_OWNER) {
      throw ApiError.forbidden();
    }
    const venue = new Venue(name, description, location, currentUser.userId);
    return this.repository.save(venue, currentUser.name);
  }
}

export const venueService = new VenueService();
