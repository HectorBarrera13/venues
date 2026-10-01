import Venue from '../entities/Venue';
import ApiError from '../errors/ApiError';
import { venueRepository, type VenueStore } from '../repositories/VenueRepository';

export interface VenueInput {
  name: string;
  description: string;
  location: string;
  ownerId?: string;
}

export interface VenueUser {
  userId?: string;
  id?: string;
  role?: string;
}

export class VenueService {
  constructor(private readonly repository: Pick<VenueStore, 'findAll' | 'save'> = venueRepository) {}

  listVenues(): Venue[] {
    return this.repository.findAll();
  }

  registerVenue(data: VenueInput, currentUser?: VenueUser): Venue {
    for (const field of ['name', 'description', 'location'] as const) {
      const value = data?.[field];
      if (!value || !String(value).trim()) {
        throw new ApiError(400, `Field "${field}" is required`);
      }
    }

    const ownerId = currentUser?.userId || currentUser?.id || data.ownerId || 'venue-owner-1';
    const venue = new Venue(data.name.trim(), data.description.trim(), data.location.trim(), ownerId);
    return this.repository.save(venue);
  }
}

export const venueService = new VenueService();
