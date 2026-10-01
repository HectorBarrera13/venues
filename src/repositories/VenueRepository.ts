import { PrismaClient, type Venue as PrismaVenue } from '@prisma/client';
import { prisma } from '../database/prisma';
import Venue from '../entities/Venue';

export interface VenueStore {
  save(venue: Venue, ownerName?: string): Promise<Venue>;
  findAll(): Promise<Venue[]>;
  findById(id: string): Promise<Venue | null>;
}

function toDomain(record: PrismaVenue): Venue {
  return new Venue({ ...record, createdAt: record.createdAt });
}

export class VenueRepository implements VenueStore {
  constructor(private readonly client: PrismaClient = prisma) {}

  async save(venue: Venue, ownerName?: string): Promise<Venue> {
    if (!venue) throw new Error('Venue cannot be null or undefined');

    await this.client.venueOwner.upsert({
      where: { id: venue.ownerId },
      create: { id: venue.ownerId, name: ownerName || venue.ownerId },
      update: ownerName ? { name: ownerName } : {},
    });

    const record = await this.client.venue.upsert({
      where: { id: venue.id },
      create: {
        id: venue.id,
        name: venue.name,
        description: venue.description,
        location: venue.location,
        createdAt: new Date(venue.createdAt),
        owner: { connect: { id: venue.ownerId } },
      },
      update: {
        name: venue.name,
        description: venue.description,
        location: venue.location,
        owner: { connect: { id: venue.ownerId } },
      },
    });

    return toDomain(record);
  }

  async findAll(): Promise<Venue[]> {
    const records = await this.client.venue.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<Venue | null> {
    const record = await this.client.venue.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }
}

export const venueRepository = new VenueRepository();
