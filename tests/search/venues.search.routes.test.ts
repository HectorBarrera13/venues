import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { AUTH_CONFIG } from '../../src/auth/authConfig';
import { haversineDistanceKm, roundDistanceKm } from '../../src/entities/Venue';
import { VenueRepository, venueRepository } from '../../src/repositories/VenueRepository';
import { createInMemoryMongoPrisma, toStoredVenueDoc, type StoredVenueDoc } from './helpers';

const TEST_SECRET = 'integration-test-secret';
process.env.JWT_SECRET = TEST_SECRET;

function bearer(role: string, sub = 'search-user'): string {
  return `Bearer ${jwt.sign({ [AUTH_CONFIG.claims.role]: role }, TEST_SECRET, {
    algorithm: AUTH_CONFIG.algorithm,
    subject: sub,
    expiresIn: '1h',
  })}`;
}

const ORGANIZER = bearer(AUTH_CONFIG.roles.ORGANIZER);
const OWNER = bearer(AUTH_CONFIG.roles.VENUE_OWNER, 'owner-1');
const FAN = bearer('FAN', 'fan-1');

describe('C4-info & C5 Read and Search Routes (VEN-301..VEN-309)', () => {
  let docs: StoredVenueDoc[];
  let testRepo: VenueRepository;

  beforeEach(() => {
    docs = [
      toStoredVenueDoc({
        id: 'venue-riviera',
        name: 'Sala Riviera Madrid',
        address: 'Paseo Bajo de la Virgen del Puerto',
        city: 'Madrid',
        country: 'ES',
        location: { lat: 40.4126, lng: -3.7224 },
        latestMapVersion: 2,
        ownerId: 'owner-1',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      toStoredVenueDoc({
        id: 'venue-getafe',
        name: 'Coliseo Getafe',
        address: 'Av. Teresa de Calcuta',
        city: 'Getafe',
        country: 'ES',
        location: { lat: 40.3257, lng: -3.7145 },
        latestMapVersion: 1,
        ownerId: 'owner-2',
        createdAt: '2026-01-02T10:00:00.000Z',
      }),
      toStoredVenueDoc({
        id: 'venue-boundary',
        name: 'Exact Boundary Hall',
        address: 'Boundary Road',
        city: 'Madrid',
        country: 'ES',
        // Approx 19.95 km north of (40.41, -3.70) — inside 20 km inclusive limit
        location: { lat: 40.5894, lng: -3.7 },
        latestMapVersion: 1,
        ownerId: 'owner-2',
        createdAt: '2026-01-03T10:00:00.000Z',
      }),
      toStoredVenueDoc({
        id: 'venue-toledo',
        name: 'Auditorio Toledo',
        address: 'Centro',
        city: 'Toledo',
        country: 'ES',
        // ~67 km away from Madrid center -> outside 20 km radius
        location: { lat: 39.8628, lng: -4.0273 },
        latestMapVersion: 1,
        ownerId: 'owner-3',
        createdAt: '2026-01-04T10:00:00.000Z',
      }),
      toStoredVenueDoc({
        id: 'venue-malaga',
        name: 'Teatro Cervantes',
        address: 'Calle Ramos Marín',
        city: 'Málaga',
        country: 'ES',
        location: { lat: 36.7248, lng: -4.4184 },
        latestMapVersion: 1,
        ownerId: 'owner-3',
        createdAt: '2026-01-05T10:00:00.000Z',
      }),
      toStoredVenueDoc({
        id: 'venue-cdmx',
        name: 'Foro México',
        address: 'Reforma 100',
        city: 'Ciudad de México',
        country: 'MX',
        location: { lat: 19.4326, lng: -99.1332 },
        latestMapVersion: 1,
        ownerId: 'owner-4',
        createdAt: '2026-01-06T10:00:00.000Z',
      }),
      toStoredVenueDoc({
        id: 'venue-unmapped',
        name: 'Sala Sin Mapa Madrid',
        address: 'Gran Vía 1',
        city: 'Madrid',
        country: 'ES',
        location: { lat: 40.419, lng: -3.701 },
        latestMapVersion: 0,
        ownerId: 'owner-1',
        createdAt: '2026-01-07T10:00:00.000Z',
      }),
    ];

    const prismaMock = createInMemoryMongoPrisma(docs);
    testRepo = new VenueRepository(prismaMock as any);

    jest.spyOn(venueRepository, 'findPage').mockImplementation((args) => testRepo.findPage(args));
    jest.spyOn(venueRepository, 'search').mockImplementation((args) => testRepo.search(args));
    jest.spyOn(venueRepository, 'findById').mockImplementation((id) => testRepo.findById(id));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Flow A — Geospatial radius search (VEN-303)', () => {
    it('returns mapped venues within radius ordered ascending by distance_km matching Haversine', async () => {
      const center = { lat: 40.41, lng: -3.7 };
      const response = await request(app)
        .get('/venues?lat=40.41&lng=-3.70&radius_km=20')
        .set('Authorization', ORGANIZER)
        .expect(200);

      expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
      const ids = response.body.data.map((v: { id: string }) => v.id);
      expect(ids).toEqual(['venue-riviera', 'venue-getafe', 'venue-boundary']);
      expect(ids).not.toContain('venue-toledo');
      expect(ids).not.toContain('venue-unmapped');

      const distances = response.body.data.map((v: { distance_km: number }) => v.distance_km);
      expect(distances[0]).toBeLessThan(distances[1]);
      expect(distances[1]).toBeLessThan(distances[2]);

      const expectedRivieraKm = roundDistanceKm(
        haversineDistanceKm(center, { lat: 40.4126, lng: -3.7224 })
      );
      expect(Math.abs(distances[0] - expectedRivieraKm)).toBeLessThanOrEqual(0.05);
    });
  });

  describe('Flow B — Name, country & city filtering (VEN-302, VEN-304)', () => {
    it('matches accented/partial names ("sála", "SALA", "riv") combined with country & city', async () => {
      for (const q of ['sála', 'SALA', 'riv']) {
        const res = await request(app)
          .get(`/venues?country=ES&city=Madrid&name=${encodeURIComponent(q)}`)
          .set('Authorization', ORGANIZER)
          .expect(200);

        expect(res.body.data.map((v: { id: string }) => v.id)).toEqual(['venue-riviera']);
        expect('distance_km' in res.body.data[0]).toBe(false);
      }
    });

    it('matches city case- and accent-insensitively and handles regex metacharacters in name safely', async () => {
      const malagaRes = await request(app)
        .get('/venues?country=es&city=malaga')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expect(malagaRes.body.data.map((v: { id: string }) => v.id)).toEqual(['venue-malaga']);

      const cdmxRes = await request(app)
        .get('/venues?city=ciudad%20de%20mexico')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expect(cdmxRes.body.data.map((v: { id: string }) => v.id)).toEqual(['venue-cdmx']);

      const regexSafeRes = await request(app)
        .get('/venues?name=s(a)la')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expect(regexSafeRes.body.data).toEqual([]);
    });
  });

  describe('Flow C & VEN-305 — Transversal latestMapVersion >= 1 and pagination (VEN-307)', () => {
    it('excludes unmapped venues across listing and filters, and includes them as soon as mapped', async () => {
      const beforeList = await request(app).get('/venues').set('Authorization', ORGANIZER).expect(200);
      expect(beforeList.body.pagination.total).toBe(6);
      expect(beforeList.body.data.map((v: { id: string }) => v.id)).not.toContain('venue-unmapped');

      // Save first map on venue-unmapped (latestMapVersion becomes 1)
      const unmapped = docs.find((d) => d.id === 'venue-unmapped')!;
      unmapped.latestMapVersion = 1;

      const afterList = await request(app).get('/venues').set('Authorization', ORGANIZER).expect(200);
      expect(afterList.body.pagination.total).toBe(7);
      expect(afterList.body.data.map((v: { id: string }) => v.id)).toContain('venue-unmapped');

      const afterName = await request(app)
        .get('/venues?name=sin%20mapa')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expect(afterName.body.data.map((v: { id: string }) => v.id)).toEqual(['venue-unmapped']);
    });

    it('paginates 45 venues into 5 pages with limit=10 and returns 200 empty on out-of-range page', async () => {
      docs.length = 0;
      for (let i = 1; i <= 45; i++) {
        docs.push(
          toStoredVenueDoc({
            id: `v-${String(i).padStart(2, '0')}`,
            name: `Venue ${i}`,
            address: `Street ${i}`,
            city: 'Madrid',
            country: 'ES',
            location: { lat: 40.41, lng: -3.7 },
            latestMapVersion: 1,
            ownerId: 'owner-1',
            createdAt: new Date(Date.UTC(2026, 0, i)).toISOString(),
          })
        );
      }

      const page5 = await request(app)
        .get('/venues?page=5&limit=10')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expect(page5.body.data).toHaveLength(5);
      expect(page5.body.pagination).toEqual({ page: 5, limit: 10, total: 45, totalPages: 5 });

      const page6 = await request(app)
        .get('/venues?page=6&limit=10')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expect(page6.body).toEqual({
        data: [],
        pagination: { page: 6, limit: 10, total: 45, totalPages: 5 },
      });
    });

    it('returns 200 with zero totals on zero matches (never 404) and ignores unknown params', async () => {
      const res = await request(app)
        .get('/venues?country=JP&unknown_param=xyz')
        .set('Authorization', ORGANIZER)
        .expect(200);

      expect(res.body).toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe('Edge cases — Coordinate/radius 400 validation (VEN-306)', () => {
    it('returns exact spec message for ?lat=95&lng=-0.37&radius_km=-5', async () => {
      const res = await request(app)
        .get('/venues?lat=95&lng=-0.37&radius_km=-5')
        .set('Authorization', ORGANIZER)
        .expect(400);

      expect(res.body).toEqual({ error: 'Invalid coordinates or radius' });
    });

    it.each([
      '/venues?lat=40.41&lng=-3.70&radius_km=0',
      '/venues?lat=40.41&lng=-3.70&radius_km=abc',
    ])('returns 400 for %s', async (url) => {
      const res = await request(app).get(url).set('Authorization', ORGANIZER).expect(400);
      expect(res.body).toEqual({ error: 'Invalid coordinates or radius' });
    });

    it('accepts boundary lat=90', async () => {
      await request(app)
        .get('/venues?lat=90&lng=0&radius_km=10')
        .set('Authorization', ORGANIZER)
        .expect(200);
    });
  });

  describe('Detail & Auth rules (VEN-301, VEN-308)', () => {
    it('allows OWNER, ORGANIZER and FAN to read list and detail (including latestMapVersion: 0)', async () => {
      for (const auth of [OWNER, ORGANIZER, FAN]) {
        await request(app).get('/venues').set('Authorization', auth).expect(200);
        const detail = await request(app)
          .get('/venues/venue-unmapped')
          .set('Authorization', auth)
          .expect(200);
        expect(detail.body.latestMapVersion).toBe(0);
        expect(detail.body.ownerId).toBe('owner-1');
        expect(detail.body).not.toHaveProperty('seats');
      }
    });

    it('mirrors routes under /api/venues and enforces 401 when unauthenticated', async () => {
      await request(app).get('/api/venues?country=ES').set('Authorization', FAN).expect(200);
      await request(app).get('/api/venues/venue-riviera').set('Authorization', FAN).expect(200);
      await request(app).get('/venues').expect(401);
      await request(app).get('/venues/venue-riviera').expect(401);
    });
  });
});
