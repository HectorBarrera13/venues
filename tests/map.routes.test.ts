import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { AUTH_CONFIG } from '../src/auth/authConfig';
import { parseMapVersionQuery } from '../src/validation/mapInput';

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
const payload = { stage: null, zones: [], seats: [] };

describe.each(['/venues', '/api/venues'])('seat map contract stubs under %s', (base) => {
  const url = `${base}/venue-1/map`;

  describe('POST /{id}/map', () => {
    it('answers 501 (not 404) for a venue owner', async () => {
      const response = await request(app).post(url).set('Authorization', OWNER).send(payload).expect(501);
      expect(response.body.error).toMatch(/not implemented/i);
    });

    it('answers 401 without a token', async () => {
      await request(app).post(url).send(payload).expect(401);
    });

    it('answers 403 for an organizer', async () => {
      await request(app).post(url).set('Authorization', ORGANIZER).send(payload).expect(403);
    });

    it('accepts bodies above the default 100 kB limit', async () => {
      const seats = Array.from({ length: 3000 }, (_, index) => ({
        id: `seat-${index}`, label: String(index), row: 'A', zone: 'z-1', position: { x: 0.5, y: 0.5 },
      }));
      await request(app).post(url).set('Authorization', OWNER).send({ ...payload, seats }).expect(501);
    });
  });

  describe('GET /{id}/map', () => {
    it('answers 501 (not 404) for any partner role', async () => {
      await request(app).get(url).set('Authorization', ORGANIZER).expect(501);
      await request(app).get(`${url}?version=2`).set('Authorization', OWNER).expect(501);
    });

    it('answers 400 for an invalid version', async () => {
      const response = await request(app).get(`${url}?version=0`).set('Authorization', ORGANIZER).expect(400);
      expect(response.body.error).toContain('"version"');
    });

    it('answers 401 without a token', async () => {
      await request(app).get(url).expect(401);
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
