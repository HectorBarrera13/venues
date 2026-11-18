import { Prisma, PrismaClient, type Venue as PrismaVenue } from '@prisma/client';
import { prisma } from '../database/prisma';
import Venue, { fromGeoPoint, normalizeVenueName, roundDistanceKm } from '../entities/Venue';
import type { VenueSearchFilters } from '../validation/venueInput';

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

/** Identity of a venue without an OpenStreetMap reference: normalized name + position. */
export interface VenueIdentity {
  nameNormalized: string;
  lat: number;
  lng: number;
}

/** Decimals compared by the fallback dedupe (4 decimals is about 11 m). */
export const DEDUPE_COORDINATE_DECIMALS = 4;

export function roundCoordinate(value: number): number {
  const factor = 10 ** DEDUPE_COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
export interface VenueSearchRequest extends PageRequest {
  filters: VenueSearchFilters;
}

export interface VenueSearchHit {
  venue: Venue;
  distanceKm?: number;
}

export interface VenueSearchPage {
  items: VenueSearchHit[];
  total: number;
}

export interface VenueStore {
  save(venue: Venue, ownerName?: string): Promise<Venue>;
  findPage(page: PageRequest): Promise<VenuePage>;
  search(request: VenueSearchRequest): Promise<VenueSearchPage>;
  findById(id: string): Promise<Venue | null>;
  findByOsmRef(osmRef: string): Promise<Venue | null>;
  findDuplicate(identity: VenueIdentity): Promise<Venue | null>;
}

const DIACRITIC_CLASSES: Record<string, string> = {
  a: '[aàáâãäåāăą]',
  c: '[cçćĉċč]',
  d: '[dďđ]',
  e: '[eèéêëēĕėęě]',
  g: '[gĝğġģ]',
  h: '[hĥħ]',
  i: '[iìíîïĩīĭįı]',
  j: '[jĵ]',
  k: '[kķ]',
  l: '[lĺļľŀł]',
  n: '[nñńņň]',
  o: '[oòóôõöøōŏő]',
  r: '[rŕŗř]',
  s: '[sśŝşš]',
  t: '[tţťŧ]',
  u: '[uùúûüũūŭůűų]',
  w: '[wŵ]',
  y: '[yýÿŷ]',
  z: '[zźżž]',
};

/** Escapes PCRE/JS regular-expression metacharacters so user text is matched literally. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds an anchored regex pattern that matches a city name regardless of
 * ASCII vs accented characters, case (when paired with `i`) or extra spaces.
 */
export function buildDiacriticInsensitiveExactPattern(value: string): string {
  const stripped = value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  let pattern = '';
  for (const ch of stripped) {
    if (ch === ' ') {
      pattern += '\\s+';
    } else {
      pattern += DIACRITIC_CLASSES[ch.toLowerCase()] ?? escapeRegex(ch);
    }
  }
  return `^${pattern}$`;
}

/**
 * Translates C5 search filters into a MongoDB filter document.
 * Always enforces `latestMapVersion >= 1` so unmapped venues cannot appear in search.
 */
export function buildMongoSearchFilter(filters: VenueSearchFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    latestMapVersion: { $gte: 1 },
  };

  if (filters.country) {
    filter.country = filters.country.toUpperCase();
  }

  if (filters.city) {
    filter.city = {
      $regex: buildDiacriticInsensitiveExactPattern(filters.city),
      $options: 'i',
    };
  }

  if (filters.name) {
    const normalized = normalizeVenueName(filters.name);
    filter.nameNormalized = normalized
      ? { $regex: escapeRegex(normalized) }
      : { $eq: '\u0000' };
  }

  return filter;
}

/**
 * Builds the MongoDB aggregation pipeline for C5 search.
 * When `near` is present, stage 1 is `$geoNear` backed by the `2dsphere` index,
 * ordering strictly by ascending distance and computing `distanceMeters`.
 */
export function buildSearchPipeline({ skip, take, filters }: VenueSearchRequest): Record<string, unknown>[] {
  const matchFilter = buildMongoSearchFilter(filters);
  const facet = {
    $facet: {
      items: [{ $skip: skip }, { $limit: take }],
      meta: [{ $count: 'total' }],
    },
  };

  if (filters.near) {
    const { lat, lng, radiusKm } = filters.near;
    return [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          key: 'location',
          query: matchFilter,
        },
      },
      { $sort: { distanceMeters: 1, createdAt: 1, _id: 1 } },
      facet,
    ];
  }

  return [
    { $match: matchFilter },
    { $sort: { createdAt: 1, _id: 1 } },
    facet,
  ];
}

function parseRawDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value && typeof value === 'object' && '$date' in value) {
    return new Date(String((value as { $date: unknown }).$date));
  }
  return new Date(String(value));
}

function parseRawCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && '$numberLong' in value) {
    return Number((value as { $numberLong: unknown }).$numberLong);
  }
  return Number(value ?? 0);
}

function rawToSearchHit(raw: Record<string, unknown>): VenueSearchHit {
  const locationRaw = raw.location as { coordinates: number[] };
  const venue = new Venue({
    id: typeof raw._id === 'string' ? raw._id : String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: typeof raw.description === 'string' ? raw.description : null,
    address: String(raw.address ?? ''),
    city: String(raw.city ?? ''),
    country: String(raw.country ?? ''),
    location: fromGeoPoint(locationRaw),
    externalId: typeof raw.externalId === 'string' ? raw.externalId : null,
    externalSource: typeof raw.externalSource === 'string' ? raw.externalSource : null,
    osmRef: typeof raw.osmRef === 'string' ? raw.osmRef : null,
    latestMapVersion: Number(raw.latestMapVersion ?? 0),
    ownerId: String(raw.ownerId ?? ''),
    createdAt: parseRawDate(raw.createdAt),
  });

  if (typeof raw.distanceMeters === 'number') {
    return { venue, distanceKm: roundDistanceKm(raw.distanceMeters / 1000) };
  }
  return { venue };
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
    const where = { latestMapVersion: { gte: 1 } };
    const [records, total] = await Promise.all([
      this.client.venue.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.client.venue.count({ where }),
    ]);
    return { items: records.map(toDomain), total };
  }

  async search(request: VenueSearchRequest): Promise<VenueSearchPage> {
    const pipeline = buildSearchPipeline(request);
    const rawResult = await this.client.venue.aggregateRaw({
      pipeline: pipeline as Prisma.InputJsonValue[],
    });

    const first = (Array.isArray(rawResult) ? rawResult[0] : rawResult) as
      | { items?: Record<string, unknown>[]; meta?: Array<{ total?: unknown }> }
      | undefined;
    const rawItems = Array.isArray(first?.items) ? first.items : [];
    const total = parseRawCount(first?.meta?.[0]?.total);

    return {
      items: rawItems.map(rawToSearchHit),
      total,
    };
  }

  async findById(id: string): Promise<Venue | null> {
    const record = await this.client.venue.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByOsmRef(osmRef: string): Promise<Venue | null> {
    const record = await this.client.venue.findFirst({ where: { osmRef } });
    return record ? toDomain(record) : null;
  }

  /** Venue with the same normalized name whose coordinates match after rounding to 4 decimals. */
  async findDuplicate({ nameNormalized, lat, lng }: VenueIdentity): Promise<Venue | null> {
    const records = await this.client.venue.findMany({ where: { nameNormalized } });
    const [targetLat, targetLng] = [roundCoordinate(lat), roundCoordinate(lng)];
    const match = records.find((record) => {
      const location = fromGeoPoint(record.location);
      return roundCoordinate(location.lat) === targetLat && roundCoordinate(location.lng) === targetLng;
    });
    return match ? toDomain(match) : null;
  }
}

export const venueRepository = new VenueRepository();
