import { haversineDistanceKm, roundDistanceKm } from '../../src/entities/Venue';
import {
  buildDiacriticInsensitiveExactPattern,
  buildMongoSearchFilter,
  buildSearchPipeline,
  escapeRegex,
  VenueRepository,
} from '../../src/repositories/VenueRepository';
import { createInMemoryMongoPrisma, toStoredVenueDoc } from './helpers';

describe('Venue search repository & geospatial builders', () => {
  describe('escapeRegex & buildDiacriticInsensitiveExactPattern', () => {
    it('escapes regex metacharacters safely', () => {
      const escaped = escapeRegex('s(a)la[1].*+?^$|\\');
      expect(() => new RegExp(escaped)).not.toThrow();
      expect(new RegExp(escaped).test('s(a)la[1].*+?^$|\\')).toBe(true);
    });

    it('matches cities case- and accent-insensitively with exact boundaries', () => {
      const regex = new RegExp(buildDiacriticInsensitiveExactPattern('ciudad de mexico'), 'i');
      expect(regex.test('Ciudad de México')).toBe(true);
      expect(regex.test('CIUDAD DE MÉXICO')).toBe(true);
      expect(regex.test('Ciudad de Mexico')).toBe(true);
      expect(regex.test('México')).toBe(false);
      expect(regex.test('Ciudad de México Sur')).toBe(false);

      const malaga = new RegExp(buildDiacriticInsensitiveExactPattern('Málaga'), 'i');
      expect(malaga.test('malaga')).toBe(true);

      const saoPaulo = new RegExp(buildDiacriticInsensitiveExactPattern('sao paulo'), 'i');
      expect(saoPaulo.test('São Paulo')).toBe(true);
    });
  });

  describe('buildMongoSearchFilter & buildSearchPipeline', () => {
    it('always enforces latestMapVersion >= 1 across every filter variant', () => {
      expect(buildMongoSearchFilter({})).toEqual({ latestMapVersion: { $gte: 1 } });
      expect(buildMongoSearchFilter({ country: 'es' })).toEqual({
        latestMapVersion: { $gte: 1 },
        country: 'ES',
      });
    });

    it('normalizes name and avoids regex errors on punctuation/metacharacters', () => {
      expect(buildMongoSearchFilter({ name: '  Sála  ' })).toEqual({
        latestMapVersion: { $gte: 1 },
        nameNormalized: { $regex: 'sala' },
      });

      const metaFilter = buildMongoSearchFilter({ name: 's(a)la' });
      expect(metaFilter.nameNormalized).toEqual({ $regex: 's a la' });

      const punctOnly = buildMongoSearchFilter({ name: '()' });
      expect(punctOnly.nameNormalized).toEqual({ $eq: '\u0000' });
    });

    it('builds a $geoNear pipeline backed by the 2dsphere location field when near is given', () => {
      const pipeline = buildSearchPipeline({
        skip: 10,
        take: 10,
        filters: {
          near: { lat: 40.41, lng: -3.7, radiusKm: 20 },
          country: 'ES',
        },
      });

      expect(pipeline[0]).toEqual({
        $geoNear: {
          near: { type: 'Point', coordinates: [-3.7, 40.41] },
          distanceField: 'distanceMeters',
          maxDistance: 20_000,
          spherical: true,
          key: 'location',
          query: {
            latestMapVersion: { $gte: 1 },
            country: 'ES',
          },
        },
      });
      expect(pipeline[1]).toEqual({ $sort: { distanceMeters: 1, createdAt: 1, _id: 1 } });
      expect(pipeline[2]).toEqual({
        $facet: {
          items: [{ $skip: 10 }, { $limit: 10 }],
          meta: [{ $count: 'total' }],
        },
      });
    });

    it('builds a $match pipeline without $geoNear for non-geospatial searches', () => {
      const pipeline = buildSearchPipeline({
        skip: 0,
        take: 20,
        filters: { country: 'ES', city: 'Madrid', name: 'riv' },
      });

      expect(pipeline[0]).toHaveProperty('$match');
      expect(pipeline[1]).toEqual({ $sort: { createdAt: 1, _id: 1 } });
      expect(pipeline[2]).toHaveProperty('$facet');
    });
  });

  describe('haversineDistanceKm & roundDistanceKm', () => {
    it('matches known coordinate pair distances with 2-decimal precision', () => {
      const madridCenter = { lat: 40.4168, lng: -3.7038 };
      const prado = { lat: 40.4138, lng: -3.6921 };
      const madridToPrado = roundDistanceKm(haversineDistanceKm(madridCenter, prado));
      expect(madridToPrado).toBeCloseTo(1.05, 1);

      const barcelona = { lat: 41.3874, lng: 2.1686 };
      const madridToBcn = roundDistanceKm(haversineDistanceKm(madridCenter, barcelona));
      expect(madridToBcn).toBeGreaterThan(500);
      expect(madridToBcn).toBeLessThan(510);

      expect(roundDistanceKm(-0)).toBe(0);
    });
  });

  describe('VenueRepository.search execution & mapping', () => {
    it('executes geo and non-geo queries against Mongo docs and parses Extended JSON', async () => {
      const docs = [
        toStoredVenueDoc({
          id: 'v-riviera',
          name: 'Sala Riviera Madrid',
          address: 'Paseo Bajo de la Virgen del Puerto',
          city: 'Madrid',
          country: 'ES',
          location: { lat: 40.4126, lng: -3.7224 },
          latestMapVersion: 1,
          ownerId: 'owner-1',
          createdAt: '2026-01-01T10:00:00.000Z',
        }),
        toStoredVenueDoc({
          id: 'v-wizink',
          name: 'WiZink Center',
          address: 'Av. Felipe II',
          city: 'Madrid',
          country: 'ES',
          location: { lat: 40.4239, lng: -3.6716 },
          latestMapVersion: 2,
          ownerId: 'owner-1',
          createdAt: '2026-01-02T10:00:00.000Z',
        }),
        toStoredVenueDoc({
          id: 'v-unmapped',
          name: 'Sala Sin Mapa',
          address: 'Calle Mayor 1',
          city: 'Madrid',
          country: 'ES',
          location: { lat: 40.415, lng: -3.705 },
          latestMapVersion: 0,
          ownerId: 'owner-2',
          createdAt: '2026-01-03T10:00:00.000Z',
        }),
      ];
      const client = createInMemoryMongoPrisma(docs);
      const repository = new VenueRepository(client as any);

      const geoResult = await repository.search({
        skip: 0,
        take: 10,
        filters: { near: { lat: 40.41, lng: -3.7, radiusKm: 20 } },
      });

      expect(geoResult.total).toBe(2);
      expect(geoResult.items.map((hit) => hit.venue.id)).toEqual(['v-riviera', 'v-wizink']);
      expect(geoResult.items[0].distanceKm).toBeLessThan(geoResult.items[1].distanceKm!);
      expect(geoResult.items[0].venue.createdAt).toBe('2026-01-01T10:00:00.000Z');

      const nameResult = await repository.search({
        skip: 0,
        take: 10,
        filters: { name: 'sála', country: 'ES', city: 'madrid' },
      });
      expect(nameResult.total).toBe(1);
      expect(nameResult.items[0].venue.id).toBe('v-riviera');
      expect(nameResult.items[0].distanceKm).toBeUndefined();
    });

    it('handles empty meta array and $numberLong total cleanly', async () => {
      const client = {
        venue: {
          aggregateRaw: jest.fn().mockResolvedValueOnce([{ items: [], meta: [] }]).mockResolvedValueOnce([
            { items: [], meta: [{ total: { $numberLong: '45' } }] },
          ]),
        },
      };
      const repository = new VenueRepository(client as any);

      await expect(repository.search({ skip: 0, take: 20, filters: { country: 'MX' } })).resolves.toEqual({
        items: [],
        total: 0,
      });

      await expect(repository.search({ skip: 40, take: 10, filters: { country: 'MX' } })).resolves.toEqual({
        items: [],
        total: 45,
      });
    });
  });
});
