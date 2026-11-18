import { PrismaClient, type Venue as PrismaVenue } from '@prisma/client';
import { prisma } from '../database/prisma';
import Venue, { fromGeoPoint } from '../entities/Venue';

export interface PageRequest {
  /** Number of records to skip. */
  skip: number;
  /** Maximum number of records to return. */
  take: number;
}

export interface VenuePage {
  items: Venue[];
  total: number;
}

export interface VenueStore {
  save(venue: Venue, ownerName?: string): Promise<Venue>;
  findPage(page: PageRequest): Promise<VenuePage>;
  findById(id: string): Promise<Venue | null>;
  findByOsmRef(osmRef: string): Promise<Venue | null>;
}

function toDomain(record: PrismaVenue): Venue {
  return new Venue({
    id: record.id,
    name: record.name,
    description: record.description,
    address: record.address,
    city: record.city,
    country: record.country,
    location: fromGeoPoint(record.location),
    externalId: record.externalId,
    externalSource: record.externalSource,
    osmRef: record.osmRef,
    latestMapVersion: record.latestMapVersion,
    ownerId: record.ownerId,
    createdAt: record.createdAt,
  });
}

function editableFields(venue: Venue) {
  return {
    name: venue.name,
    nameNormalized: venue.nameNormalized,
    description: venue.description,
    address: venue.address,
    city: venue.city,
    country: venue.country,
    location: venue.toGeoPoint(),
    externalId: venue.externalId,
    externalSource: venue.externalSource,
    osmRef: venue.osmRef,
  };
}

export class VenueRepository implements VenueStore {
  constructor(private readonly client: PrismaClient = prisma) {}

  async save(venue: Venue, ownerName?: string): Promise<Venue> {
    await this.client.venueOwner.upsert({
      where: { id: venue.ownerId },
      create: { id: venue.ownerId, name: ownerName || venue.ownerId },
      update: ownerName ? { name: ownerName } : {},
    });

    // latestMapVersion is owned by the map-version write path, never by venue edits.
    const record = await this.client.venue.upsert({
      where: { id: venue.id },
      create: {
        id: venue.id,
        ...editableFields(venue),
        latestMapVersion: venue.latestMapVersion,
        createdAt: new Date(venue.createdAt),
        owner: { connect: { id: venue.ownerId } },
      },
      update: editableFields(venue),
    });

    return toDomain(record);
  }

  async findPage({ skip, take }: PageRequest): Promise<VenuePage> {
    const [records, total] = await Promise.all([
      this.client.venue.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.client.venue.count(),
    ]);
    return { items: records.map(toDomain), total };
  }

  async findById(id: string): Promise<Venue | null> {
    const record = await this.client.venue.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByOsmRef(osmRef: string): Promise<Venue | null> {
    const record = await this.client.venue.findFirst({ where: { osmRef } });
    return record ? toDomain(record) : null;
  }
}

export const venueRepository = new VenueRepository();
