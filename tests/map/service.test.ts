/**
 * VEN-203/VEN-204/VEN-205 service-level tests: check ordering, the versioned
 * transactional save with conflict retry, reads by version, and the immutable
 * repository surface. The stores are fakes; the dockerized replica-set run in CI
 * covers Prisma's `$transaction` itself (see VEN-203 acceptance).
 */
import MapVersion from '../../src/entities/MapVersion';
import Venue from '../../src/entities/Venue';
import ApiError from '../../src/errors/ApiError';
import type { MapPayload } from '../../src/maps/mapFormat';
import { MapVersionConflictError, MapVersionRepository } from '../../src/services/map/MapVersionRepository';
import { SAVE_CONFLICT_RETRIES, MapService } from '../../src/services/map/MapService';
import type { MapVersionStore } from '../../src/services/map/MapVersionRepository';

const OWNER_ID = 'owner-1';

function venue(latestMapVersion = 0, ownerId = OWNER_ID): Venue {
  return new Venue({
    id: 'venue-1',
    name: 'Auditorio Nacional',
    address: 'Paseo de la Reforma 50',
    city: 'Ciudad de Mexico',
    country: 'MX',
    location: { lat: 19.4245, lng: -99.1951 },
    ownerId,
    latestMapVersion,
  });
}

const square = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

/** Structurally sound and semantically valid payload, with 5-decimal coordinates. */
const validBody = {
  stage: { outline: square(0.3, 0.0, 0.7, 0.04) },
  zones: [{ id: 'z-1', name: 'Main', outline: square(0, 0.05, 1, 0.99) }],
  seats: [{ id: 's-1', label: '1', row: 'A', zone: 'z-1', position: { x: 0.12345, y: 0.5 } }],
};

interface FakeStore extends MapVersionStore {
  calls: { venueId: string; map: MapPayload }[];
  versions: MapVersion[];
}

function fakeStore(): FakeStore {
  const versions: MapVersion[] = [];
  const calls: FakeStore['calls'] = [];
  let conflictTimes = 0;
  const store: FakeStore = {
    calls,
    versions,
    saveNewVersion: async (venueId, map) => {
      calls.push({ venueId, map });
      if (conflictTimes > 0) {
        conflictTimes -= 1;
        throw new MapVersionConflictError(venueId, versions.length + 1);
      }
      const version = new MapVersion({ venueId, version: versions.length + 1, createdAt: new Date(), ...structuredClone(map) });
      versions.push(version);
      return version;
    },
    findByVenueVersion: async (venueId, version) => versions.find((m) => m.venueId === venueId && m.version === version) ?? null,
    findLatest: async (venueId) => [...versions].reverse().find((m) => m.venueId === venueId) ?? null,
  };
  (store as any).conflict = (times: number) => { conflictTimes = times; };
  return store;
}

function buildService(existing: Venue | null, maps = fakeStore()) {
  const venues = { findById: async () => existing };
  const service = new MapService(venues, maps);
  return { service, stores: { venues, maps } };
}

const user = { userId: OWNER_ID, role: 'VENUE_OWNER' };

describe('MapService.saveMap — check order (VEN-203)', () => {
  it('404s an unknown venue before parsing the body', async () => {
    const { service, stores } = buildService(null);
    await expect(service.saveMap('missing', '{{{ not json', user)).rejects.toMatchObject({ status: 404 });
    expect(stores.maps.calls).toHaveLength(0);
  });

  it('403s a non-owner before running any validation', async () => {
    const { service, stores } = buildService(venue(0, 'other-owner'));
    await expect(service.saveMap('venue-1', { stage: null, zones: [], seats: [] }, user))
      .rejects.toMatchObject({ status: 403 });
    expect(stores.maps.calls).toHaveLength(0);
  });

  it('422s broken business rules without persisting anything', async () => {
    const { service, stores } = buildService(venue());
    let error: ApiError | undefined;
    try {
      await service.saveMap('venue-1', { ...validBody, stage: null }, user);
    } catch (thrown) {
      error = thrown as ApiError;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.status).toBe(422);
    expect(error?.details).toEqual({ errors: [{ code: 'NO_STAGE', message: expect.any(String) }] });
    expect(stores.maps.calls).toHaveLength(0);
    expect(stores.maps.versions).toHaveLength(0);
  });
});

describe('MapService.saveMap — versioned write (VEN-203)', () => {
  it('stores the normalized payload: coordinates rounded, rotation defaulted', async () => {
    const { service, stores } = buildService(venue());
    const first = await service.saveMap('venue-1', validBody, user);
    expect(first.version).toBe(1);
    const stored = stores.maps.calls[0].map;
    expect(stored.seats[0].position).toEqual({ x: 0.1235, y: 0.5 });
    expect(stored.seats[0].rotation).toBe(0);
  });

  it('second save returns version 2 while version 1 stays retrievable and identical', async () => {
    const { service, stores } = buildService(venue());
    await service.saveMap('venue-1', validBody, user);
    const second = await service.saveMap('venue-1', validBody, user);
    expect(second.version).toBe(2);
    const v1 = await stores.maps.findByVenueVersion('venue-1', 1);
    expect(v1?.toJSON()).toEqual(stores.maps.versions[0].toJSON());
  });

  it('retries a lost version race and lands on the next consecutive version', async () => {
    const { service, stores } = buildService(venue());
    (stores.maps as any).conflict(2);
    const saved = await service.saveMap('venue-1', validBody, user);
    expect(saved.version).toBe(1);
    expect(stores.maps.calls).toHaveLength(3); // two conflicts + one success
  });

  it('gives up after the retry budget instead of spinning forever', async () => {
    const { service, stores } = buildService(venue());
    (stores.maps as any).conflict(SAVE_CONFLICT_RETRIES + 5);
    await expect(service.saveMap('venue-1', validBody, user)).rejects.toBeInstanceOf(MapVersionConflictError);
    expect(stores.maps.calls).toHaveLength(SAVE_CONFLICT_RETRIES + 1);
  });
});

describe('MapService.getMap — reads (VEN-204)', () => {
  it('404s a venue without a map', async () => {
    const { service } = buildService(venue(0));
    await expect(service.getMap('venue-1')).rejects.toMatchObject({ status: 404, message: expect.stringContaining('no map yet') });
  });

  it('404s an unknown version even below-the-limit numbers that were never saved', async () => {
    const { service } = buildService(venue(5));
    await service.saveMap('venue-1', validBody, user); // fake store starts at 1
    await expect(service.getMap('venue-1', 3)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the latest when no version is asked and the exact one when asked', async () => {
    const { service, stores } = buildService(venue());
    const v1 = await service.saveMap('venue-1', validBody, user);
    const saved = structuredClone(validBody);
    saved.seats[0].position = { x: 0.2, y: 0.6 };
    const v2 = await service.saveMap('venue-1', saved, user);
    // The fake venue pointer moves the way the transactional store moves it in production.
    const withPointer = new MapService({ findById: async () => venue(2) }, stores.maps);
    expect(await withPointer.getMap('venue-1', 1)).toBe(v1);
    expect(await withPointer.getMap('venue-1')).toBe(v2);
    expect(stores.maps.versions).toHaveLength(2);
  });
});

describe('MapVersionRepository — immutable by construction (VEN-205)', () => {
  const methods = Object.getOwnPropertyNames(MapVersionRepository.prototype).filter((n) => n !== 'constructor');

  it('exposes only the save and the reads', () => {
    expect(methods.sort()).toEqual(['findByVenueVersion', 'findLatest', 'saveNewVersion']);
  });

  it('has no update or delete path', () => {
    for (const name of methods) {
      expect(name).not.toMatch(/update|delete|remove|patch|destroy/i);
    }
  });
});
