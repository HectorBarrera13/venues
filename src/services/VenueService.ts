import Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import { venueRepository, type VenueStore } from '../repositories/VenueRepository';

export interface CreateVenueInput {
  name?: string;
  description?: string;
  location?: string;
}

export interface VenueUser {
  userId?: string;
  id?: string;
  name?: string;
  role?: string;
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

  async registerVenue(data: CreateVenueInput | undefined, currentUser?: VenueUser): Promise<Venue> {
    const name = requiredText(data?.name, 'name');
    const description = requiredText(data?.description, 'description');
    const location = requiredText(data?.location, 'location');
    if (currentUser?.role !== 'venue_owner') {
      throw ApiError.forbidden();
    }
    const venue = new Venue(name, description, location, currentUser.userId!);
    return this.repository.save(venue, currentUser.name);
  }
}

export const venueService = new VenueService();
