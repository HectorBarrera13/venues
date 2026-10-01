import Venue from '../entities/Venue';

export interface VenueStore {
  save(venue: Venue): Venue;
  findAll(): Venue[];
  findById(id: string): Venue | null;
}

/** In-memory venue store retained until the MongoDB repository is merged. */
export class VenueRepository<T extends { id: string } = Venue> {
  private venues: T[];

  constructor(initialVenues: T[] = []) {
    this.venues = [...initialVenues];
  }

  reset(initialVenues: T[] = []): void {
    this.venues = [...initialVenues];
  }

  save(venue: T): T {
    if (!venue) throw new Error('Venue cannot be null or undefined');
    const index = this.venues.findIndex((item) => item.id === venue.id);
    if (index === -1) this.venues.push(venue);
    else this.venues[index] = venue;
    return venue;
  }

  findAll(): T[] {
    return [...this.venues];
  }

  findById(id: string): T | null {
    return this.venues.find((item) => item.id === id) ?? null;
  }
}

export const venueRepository = new VenueRepository();
