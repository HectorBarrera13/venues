import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { AUTH_CONFIG } from '../src/auth/authConfig';
import MapVersion from '../src/entities/MapVersion';
import { venueRepository } from '../src/repositories/VenueRepository';
import { mapVersionRepository } from '../src/services/map/MapVersionRepository';
import { parseMapVersionQuery } from '../src/validation/mapInput';
import { buildVenue } from './helpers/venues';

const TEST_SECRET = 'integration-test-secret';
process.env.JWT_SECRET = TEST_SECRET;

function bearer(role: string): string {
  return `Bearer ${jwt.sign({ [AUTH_CONFIG.claims.role]: role }, TEST_SECRET, {
    algorithm: AUTH_CONFIG.algorithm,
    subject: 'map-test-user',
    expiresIn: '1h',
  })}`;
}

const OWNER = bearer(AUTH_CONFIG.roles.VENUE_OWNER);
const ORGANIZER = bearer(AUTH_CONFIG.roles.ORGANIZER);

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/maps');
function loadFixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}
const validMap = loadFixture('valid-v1.json');

/** The venue under test, owned by the `sub` of the test tokens. */
function mappedVenue(latestMapVersion = 0) {
  return buildVenue({ ownerId: 'map-test-user', latestMapVersion });
}

function storedVersion(version: number) {
  return new MapVersion({ venueId: 'venue-1', version, createdAt: '2026-11-18T10:00:00.000Z', ...validMap });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(['/venues', '/api/venues'])('seat map endpoints under %s', (base) => {
  const url = `${base}/venue-1/map`;

  describe('POST /{id}/map', () => {
    it('answers 401 without a token, before touching the store', async () => {
      const findById = jest.spyOn(venueRepository, 'findById');
      await request(app).post(url).send(validMap).expect(401);
      expect(findById).not.toHaveBeenCalled();
    });

    it('answers 403 for an organizer', async () => {
      await request(app).post(url).set('Authorization', ORGANIZER).send(validMap).expect(403);
    });

    it('answers 404 for an unknown venue', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(null);
      const response = await request(app).post(url).set('Authorization', OWNER).send(validMap).expect(404);
      expect(response.body.error).toContain('venue-1');
    });

    it('checks ownership before validating: a non-owner gets 403 even with a broken body', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(buildVenue({ ownerId: 'someone-else' }));
      const response = await request(app)
        .post(url).set('Authorization', OWNER).send({ stage: null, zones: 'nope', seats: [] }).expect(403);
      expect(response.body.error).toMatch(/owner/i);
    });

    it('answers 400 for an out-of-range coordinate, with the field path', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue());
      const broken = structuredClone(validMap);
      broken.seats[0].position.x = 1.2;
      const response = await request(app).post(url).set('Authorization', OWNER).send(broken).expect(400);
      expect(response.body.error).toBe(`Field "seats[0].position.x" must be a number between 0 and 1`);
    });

    it('answers 422 listing every violation of multi-error.json, and persists nothing', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue());
      const save = jest.spyOn(mapVersionRepository, 'saveNewVersion');
      const response = await request(app)
        .post(url).set('Authorization', OWNER).send(loadFixture('multi-error.json')).expect(422);
      expect(response.body.error).toBe('Map validation failed');
      const expected = loadFixture('manifest.json').fixtures['multi-error.json'].expectedErrors;
      expect(response.body.errors.map((e: any) => e.code)).toEqual(expected.map((e: any) => e.code));
      for (const issue of response.body.errors) {
        const match = expected.find((e: any) => e.code === issue.code);
        expect(issue.seatIds).toEqual(match.seatIds);
        expect(issue.zoneIds).toEqual(match.zoneIds);
      }
      expect(save).not.toHaveBeenCalled();
    });

    it('answers 201 with the stored immutable version', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue());
      const save = jest.spyOn(mapVersionRepository, 'saveNewVersion').mockResolvedValue(storedVersion(1));
      const response = await request(app).post(url).set('Authorization', OWNER).send(validMap).expect(201);
      expect(response.body).toEqual({
        venueId: 'venue-1',
        version: 1,
        createdAt: '2026-11-18T10:00:00.000Z',
        stage: validMap.stage,
        zones: validMap.zones,
        seats: validMap.seats,
      });
      const [venueId, stored] = save.mock.calls[0];
      expect(venueId).toBe('venue-1');
      // Coordinates come out rounded to the contract precision and rotations defaulted.
      expect(stored.seats.every((seat: any) => Number(seat.rotation) === seat.rotation)).toBe(true);
    });

    it('accepts and validates a 3,000-seat body above the default 100 kB limit', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue());
      const save = jest.spyOn(mapVersionRepository, 'saveNewVersion').mockResolvedValue(storedVersion(1));
      const seats = Array.from({ length: 3000 }, (_, index) => ({
        id: `seat-${index}`,
        label: String(index),
        row: String(Math.floor(index / 100)),
        zone: 'z-floor',
        position: { x: 0.005 + (index % 100) * 0.01, y: 0.0095 + Math.floor(index / 100) * 0.019 },
      }));
      const body = {
        stage: { outline: [{ x: 0.3, y: 0.02 }, { x: 0.7, y: 0.02 }, { x: 0.7, y: 0.06 }, { x: 0.3, y: 0.06 }] },
        zones: [{ id: 'z-floor', name: 'Floor', outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }],
        seats,
      };
      await request(app).post(url).set('Authorization', OWNER).send(body).expect(201);
      expect(save).toHaveBeenCalled();
    });
  });

  describe('GET /{id}/map', () => {
    it('answers 401 without a token', async () => {
      await request(app).get(url).expect(401);
    });

    it('answers 400 for an invalid version before touching the store', async () => {
      const findById = jest.spyOn(venueRepository, 'findById');
      const response = await request(app).get(`${url}?version=0`).set('Authorization', ORGANIZER).expect(400);
      expect(response.body.error).toContain('"version"');
      expect(findById).not.toHaveBeenCalled();
    });

    it('lets any partner role read the latest version', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue(2));
      jest.spyOn(mapVersionRepository, 'findLatest').mockResolvedValue(storedVersion(2));
      const response = await request(app).get(url).set('Authorization', ORGANIZER).expect(200);
      expect(response.body.version).toBe(2);
    });

    it('answers 404 for a venue without map, not 200 with null', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue(0));
      const response = await request(app).get(url).set('Authorization', OWNER).expect(404);
      expect(response.body.error).toMatch(/no map yet/i);
    });

    it('answers 404 for an unknown venue', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(null);
      await request(app).get(url).set('Authorization', OWNER).expect(404);
    });

    it('returns the exact version even when a newer one exists', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue(2));
      const find = jest.spyOn(mapVersionRepository, 'findByVenueVersion').mockResolvedValue(storedVersion(1));
      const response = await request(app).get(`${url}?version=1`).set('Authorization', OWNER).expect(200);
      expect(response.body.version).toBe(1);
      expect(find).toHaveBeenCalledWith('venue-1', 1);
    });

    it('answers 404 for a version that was never saved', async () => {
      jest.spyOn(venueRepository, 'findById').mockResolvedValue(mappedVenue(2));
      jest.spyOn(mapVersionRepository, 'findByVenueVersion').mockResolvedValue(null);
      const response = await request(app).get(`${url}?version=99`).set('Authorization', OWNER).expect(404);
      expect(response.body.error).toMatch(/version 99/);
    });
  });
});

describe('parseMapVersionQuery', () => {
  it('returns undefined for the latest version', () => {
    expect(parseMapVersionQuery({})).toBeUndefined();
  });

  it('parses a positive integer', () => {
    expect(parseMapVersionQuery({ version: '12' })).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999999999999'])('rejects "%s"', (version) => {
    expect(() => parseMapVersionQuery({ version })).toThrow('"version"');
  });

  it('rejects a repeated parameter', () => {
    expect(() => parseMapVersionQuery({ version: ['1', '2'] })).toThrow('"version"');
  });
});
