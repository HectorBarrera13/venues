/**
 * VEN-702 — Backend <-> OpenAPI contract suite.
 *
 * Exercises every endpoint C1-C5 plus /health and /ready with happy paths and
 * documented error statuses, asserting each HTTP response body against the
 * committed `openapi.json`. Fails red on any schema drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { AUTH_CONFIG } from '../../src/auth/authConfig';
import MapVersion from '../../src/entities/MapVersion';
import { venueRepository } from '../../src/repositories/VenueRepository';
import { readinessService } from '../../src/services/ReadinessService';
import { mapVersionRepository } from '../../src/services/map/MapVersionRepository';
import { buildVenue, validVenuePayload } from '../helpers/venues';
import { ContractValidator, expectToMatchContract } from './openapiContract';

const TEST_SECRET = 'contract-test-secret';
process.env.JWT_SECRET = TEST_SECRET;

function bearer(role: string, sub = 'contract-owner'): string {
  return `Bearer ${jwt.sign({ [AUTH_CONFIG.claims.role]: role }, TEST_SECRET, {
    algorithm: AUTH_CONFIG.algorithm,
    subject: sub,
    expiresIn: '1h',
  })}`;
}

const OWNER = bearer(AUTH_CONFIG.roles.VENUE_OWNER, 'contract-owner');
const ORGANIZER = bearer(AUTH_CONFIG.roles.ORGANIZER, 'contract-organizer');
const VENUE_UUID = '11111111-1111-4111-8111-111111111111';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/maps');
function loadFixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}
const validMap = loadFixture('valid-v1.json');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Backend <-> OpenAPI contract (VEN-702)', () => {
  describe('POST /venues (C1)', () => {
    it('201 Created matches Venue schema', async () => {
      const created = buildVenue({ id: VENUE_UUID, ownerId: 'contract-owner', latestMapVersion: 0 });
      jest.spyOn(venueRepository, 'findDuplicate').mockResolvedValue(null);
      jest.spyOn(venueRepository, 'save').mockResolvedValue(created);

      const res = await request(app).post('/venues').set('Authorization', OWNER).send(validVenuePayload).expect(201);
      expectToMatchContract(res);
    });

    it('400 Bad Request matches VenueValidationError schema', async () => {
      const res = await request(app)
        .post('/venues')
        .set('Authorization', OWNER)
        .send({ ...validVenuePayload, country: 'INVALID' })
        .expect(400);
      expectToMatchContract(res);
    });

    it('401 Unauthorized matches Error schema', async () => {
      const res = await request(app).post('/venues').send(validVenuePayload).expect(401);
      expectToMatchContract(res);
    });

    it('403 Forbidden matches Error schema', async () => {
      const res = await request(app).post('/venues').set('Authorization', ORGANIZER).send(validVenuePayload).expect(403);
      expectToMatchContract(res);
    });

    it('409 Conflict matches VenueConflict schema', async () => {
      jest.spyOn(venueRepository, 'findByOsmRef').mockResolvedValue(buildVenue({ id: 'existing-1', osmRef: 'node:42' }));
      const res = await request(app)
        .post('/venues')
        .set('Authorization', OWNER)
        .send({ ...validVenuePayload, osmRef: 'node:42' })
        .expect(409);
      expectToMatchContract(res);
    });
  });

  describe('GET /venues (C5)', () => {
    it('200 OK matches VenuePage schema (listing and geospatial search)', async () => {
      const mapped = buildVenue({ id: VENUE_UUID, latestMapVersion: 1 });
      jest.spyOn(venueRepository, 'findPage').mockResolvedValue({ items: [mapped], total: 1 });
      const listRes = await request(app).get('/venues').set('Authorization', ORGANIZER).expect(200);
      expectToMatchContract(listRes);

      jest.spyOn(venueRepository, 'search').mockResolvedValue({
        items: [{ venue: mapped, distanceKm: 1.25 }],
        total: 1,
      });
      const geoRes = await request(app)
        .get('/venues?lat=19.42&lng=-99.19&radius_km=10')
        .set('Authorization', ORGANIZER)
        .expect(200);
      expectToMatchContract(geoRes);
    });

    it('400 Bad Request matches Error schema', async () => {
      const res = await request(app).get('/venues?lat=95&lng=-99&radius_km=-1').set('Authorization', ORGANIZER).expect(400);
      expectToMatchContract(res);
    });

    it('401 Unauthorized matches Error schema', async () => {
      const res = await request(app).get('/venues').expect(401);
      expectToMatchContract(res);
    });
  });

  describe('GET /venues/{id} (C4-info)', () => {
    it('200 OK matches Venue schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ id: VENUE_UUID, latestMapVersion: 2 }));
      const res = await request(app).get(`/venues/${VENUE_UUID}`).set('Authorization', ORGANIZER).expect(200);
      expectToMatchContract(res);
    });

    it('401 Unauthorized matches Error schema', async () => {
      const res = await request(app).get('/venues/venue-1').expect(401);
      expectToMatchContract(res);
    });

    it('404 Not Found matches Error schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(null);
      const res = await request(app).get('/venues/missing').set('Authorization', ORGANIZER).expect(404);
      expectToMatchContract(res);
    });
  });

  describe('POST /venues/{id}/map (C3)', () => {
    it('201 Created matches MapVersion schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ ownerId: 'contract-owner', latestMapVersion: 0 }));
      jest.spyOn(mapVersionRepository, 'saveNewVersion').mockResolvedValue(
        new MapVersion({ venueId: 'venue-1', version: 1, createdAt: '2026-11-19T12:00:00.000Z', ...validMap }),
      );
      const res = await request(app).post('/venues/venue-1/map').set('Authorization', OWNER).send(validMap).expect(201);
      expectToMatchContract(res);
    });

    it('400 Bad Request matches Error schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ ownerId: 'contract-owner' }));
      const broken = structuredClone(validMap);
      broken.seats[0].position.x = 2;
      const res = await request(app).post('/venues/venue-1/map').set('Authorization', OWNER).send(broken).expect(400);
      expectToMatchContract(res);
    });

    it('401 Unauthorized matches Error schema', async () => {
      const res = await request(app).post('/venues/venue-1/map').send(validMap).expect(401);
      expectToMatchContract(res);
    });

    it('403 Forbidden matches Error schema', async () => {
      const res = await request(app).post('/venues/venue-1/map').set('Authorization', ORGANIZER).send(validMap).expect(403);
      expectToMatchContract(res);
    });

    it('404 Not Found matches Error schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(null);
      const res = await request(app).post('/venues/missing/map').set('Authorization', OWNER).send(validMap).expect(404);
      expectToMatchContract(res);
    });

    it('422 Unprocessable Entity matches MapValidationErrors schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ ownerId: 'contract-owner' }));
      const res = await request(app)
        .post('/venues/venue-1/map')
        .set('Authorization', OWNER)
        .send(loadFixture('multi-error.json'))
        .expect(422);
      expectToMatchContract(res);
    });
  });

  describe('GET /venues/{id}/map (C4-map)', () => {
    it('200 OK matches MapVersion schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ latestMapVersion: 1 }));
      jest.spyOn(mapVersionRepository, 'findLatest').mockResolvedValue(
        new MapVersion({ venueId: 'venue-1', version: 1, createdAt: '2026-11-19T12:00:00.000Z', ...validMap }),
      );
      const res = await request(app).get('/venues/venue-1/map').set('Authorization', ORGANIZER).expect(200);
      expectToMatchContract(res);
    });

    it('400 Bad Request matches Error schema', async () => {
      const res = await request(app).get('/venues/venue-1/map?version=0').set('Authorization', ORGANIZER).expect(400);
      expectToMatchContract(res);
    });

    it('401 Unauthorized matches Error schema', async () => {
      const res = await request(app).get('/venues/venue-1/map').expect(401);
      expectToMatchContract(res);
    });

    it('403 Forbidden matches Error schema', async () => {
      const unknownRole = bearer('FAN', 'fan-1');
      const res = await request(app).get('/venues/venue-1/map').set('Authorization', unknownRole).expect(403);
      expectToMatchContract(res);
    });

    it('404 Not Found matches Error schema', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ latestMapVersion: 0 }));
      const res = await request(app).get('/venues/venue-1/map').set('Authorization', ORGANIZER).expect(404);
      expectToMatchContract(res);
    });
  });

  describe('GET /health & GET /ready', () => {
    it('/health 200 matches HealthStatus schema', async () => {
      const res = await request(app).get('/health').expect(200);
      expectToMatchContract(res);
    });

    it('/ready 200 and 503 match ReadinessStatus schema', async () => {
      jest.spyOn(readinessService, 'checkVenueStore').mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      expectToMatchContract(await request(app).get('/ready').expect(200));
      expectToMatchContract(await request(app).get('/ready').expect(503));
    });
  });

  describe('Contract validator self-test (negative cases)', () => {
    it('rejects a response missing required fields or having wrong types', () => {
      const validator = new ContractValidator();
      const missingField = validator.check('GET', '/health', 200, {});
      expect(missingField.errors.length).toBeGreaterThan(0);

      const wrongType = validator.check('GET', '/venues', 200, { data: 'not-an-array', pagination: {} });
      expect(wrongType.errors.length).toBeGreaterThan(0);

      const undocumentedStatus = validator.check('GET', '/health', 418, { error: 'teapot' });
      expect(undocumentedStatus.errors[0]).toMatch(/not documented/);
    });
  });
});
