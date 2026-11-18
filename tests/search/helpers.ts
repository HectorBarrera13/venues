import Venue, { haversineDistanceKm, type VenueProps } from '../../src/entities/Venue';

export interface StoredVenueDoc {
  _id: string;
  id: string;
  name: string;
  nameNormalized: string;
  description: string | null;
  address: string;
  city: string;
  country: string;
  location: { type: 'Point'; coordinates: [number, number] };
  externalId: string | null;
  externalSource: string | null;
  osmRef: string | null;
  latestMapVersion: number;
  ownerId: string;
  createdAt: Date;
}

export function toStoredVenueDoc(props: VenueProps): StoredVenueDoc {
  const venue = new Venue(props);
  return {
    _id: venue.id,
    id: venue.id,
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
    latestMapVersion: venue.latestMapVersion,
    ownerId: venue.ownerId,
    createdAt: new Date(venue.createdAt),
  };
}

function matchesMongoFilter(doc: StoredVenueDoc, filter: Record<string, unknown>): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    const value = (doc as unknown as Record<string, unknown>)[key];

    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const cond = condition as Record<string, unknown>;
      if ('$gte' in cond && !(typeof value === 'number' && value >= Number(cond.$gte))) {
        return false;
      }
      if ('$eq' in cond && value !== cond.$eq) {
        return false;
      }
      if ('$regex' in cond) {
        const flags = typeof cond.$options === 'string' ? cond.$options : '';
        const regex = new RegExp(String(cond.$regex), flags);
        if (typeof value !== 'string' || !regex.test(value)) {
          return false;
        }
      }
    } else if (value !== condition) {
      return false;
    }
  }
  return true;
}

/**
 * Simulates the subset of Prisma MongoDB methods (`findMany`, `count`,
 * `findUnique`, `aggregateRaw` with `$geoNear`/`$match`/`$sort`/`$facet`)
 * against an in-memory venue array for deterministic C5 tests.
 */
export function createInMemoryMongoPrisma(store: StoredVenueDoc[]) {
  return {
    venue: {
      findMany: jest.fn(async (args: { where?: { latestMapVersion?: { gte?: number } }; skip?: number; take?: number } = {}) => {
        const minVersion = args.where?.latestMapVersion?.gte ?? 0;
        const filtered = store
          .filter((doc) => doc.latestMapVersion >= minVersion)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
        const skip = args.skip ?? 0;
        const take = args.take ?? filtered.length;
        return filtered.slice(skip, skip + take);
      }),
      count: jest.fn(async (args: { where?: { latestMapVersion?: { gte?: number } } } = {}) => {
        const minVersion = args.where?.latestMapVersion?.gte ?? 0;
        return store.filter((doc) => doc.latestMapVersion >= minVersion).length;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        store.find((doc) => doc.id === where.id) ?? null
      ),
      findFirst: jest.fn(async ({ where }: { where: { osmRef?: string } }) =>
        store.find((doc) => doc.osmRef === where.osmRef) ?? null
      ),
      aggregateRaw: jest.fn(async ({ pipeline }: { pipeline: Record<string, unknown>[] }) => {
        let rows: Array<StoredVenueDoc & { distanceMeters?: number }> = store.map((doc) => ({ ...doc }));

        for (const stage of pipeline) {
          if ('$geoNear' in stage) {
            const geo = stage.$geoNear as {
              near: { coordinates: [number, number] };
              maxDistance: number;
              query?: Record<string, unknown>;
            };
            const center = { lat: geo.near.coordinates[1], lng: geo.near.coordinates[0] };
            rows = rows
              .filter((doc) => !geo.query || matchesMongoFilter(doc, geo.query))
              .map((doc) => {
                const docLoc = { lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] };
                const distanceMeters = haversineDistanceKm(center, docLoc) * 1000;
                return { ...doc, distanceMeters };
              })
              .filter((doc) => (doc.distanceMeters ?? Infinity) <= geo.maxDistance)
              .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
          } else if ('$match' in stage) {
            const filter = stage.$match as Record<string, unknown>;
            rows = rows.filter((doc) => matchesMongoFilter(doc, filter));
          } else if ('$sort' in stage) {
            const sort = stage.$sort as Record<string, number>;
            rows.sort((a, b) => {
              if ('distanceMeters' in sort) {
                const diff = (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
                if (diff !== 0) return diff * sort.distanceMeters;
              }
              const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
              if (timeDiff !== 0) return timeDiff;
              return a._id.localeCompare(b._id);
            });
          } else if ('$facet' in stage) {
            const facet = stage.$facet as {
              items: Array<{ $skip?: number; $limit?: number }>;
            };
            const skip = facet.items.find((s) => '$skip' in s)?.$skip ?? 0;
            const limit = facet.items.find((s) => '$limit' in s)?.$limit ?? rows.length;
            const serializedItems = rows.slice(skip, skip + limit).map((doc) => ({
              ...doc,
              createdAt: { $date: doc.createdAt.toISOString() },
            }));
            return [
              {
                items: serializedItems,
                meta: rows.length > 0 ? [{ total: rows.length }] : [],
              },
            ];
          }
        }
        return [];
      }),
    },
  };
}
