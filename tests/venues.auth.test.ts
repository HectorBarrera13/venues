import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { AUTH_CONFIG } from '../src/auth/authConfig';
import Venue from '../src/entities/Venue';
import { venueRepository } from '../src/repositories/VenueRepository';

const TEST_SECRET = 'integration-test-secret';
process.env.JWT_SECRET = TEST_SECRET;

const { roles, claims } = AUTH_CONFIG;

function token(
  role: string,
  sub: string,
  options: jwt.SignOptions = {}
): string {
  return jwt.sign({ [claims.role]: role }, TEST_SECRET, {
    algorithm: AUTH_CONFIG.algorithm,
    subject: sub,
    expiresIn: '1h',
    ...options,
  });
}

const ownerToken = (sub = 'owner-1') => token(roles.VENUE_OWNER, sub);
const organizerToken = (sub = 'organizer-1') => token(roles.ORGANIZER, sub);

/** Rewrites the payload of a token while keeping its original signature. */
function tamper(tokenValue: string, mutate: (payload: Record<string, unknown>) => void): string {
  const [header, payload, signature] = tokenValue.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  mutate(decoded);
  return [header, Buffer.from(JSON.stringify(decoded)).toString('base64url'), signature].join('.');
}

const validPayload = {
  name: 'Foro Indie',
  description: 'Indie venue',
  location: 'Roma Norte',
};

describe('Venues API authentication and authorization', () => {
  let stored: Venue[];

  beforeEach(() => {
    stored = [];
    jest.spyOn(venueRepository, 'save').mockImplementation(async (venue: Venue) => {
      stored.push(venue);
      return venue;
    });
    jest.spyOn(venueRepository, 'findAll').mockImplementation(async () => [...stored]);
    jest.spyOn(venueRepository, 'findById').mockImplementation(
      async (id: string) => stored.find((venue) => venue.id === id) ?? null
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /venues', () => {
    it('creates a venue and attributes it to the token subject', async () => {
      const response = await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${ownerToken('owner-42')}`)
        .send(validPayload)
        .expect(201);

      expect(response.body).toMatchObject({
        name: validPayload.name,
        description: validPayload.description,
        location: validPayload.location,
        ownerId: 'owner-42',
      });
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id.length).toBeGreaterThan(0);
      expect(stored).toHaveLength(1);
    });

    it.each([
      ['name', { description: 'Desc', location: 'Loc' }],
      ['description', { name: 'Name', location: 'Loc' }],
      ['location', { name: 'Name', description: 'Desc' }],
      ['name', { ...validPayload, name: null }],
      ['description', { ...validPayload, description: null }],
      ['location', { ...validPayload, location: null }],
      ['name', { ...validPayload, name: '   ' }],
      ['description', { ...validPayload, description: '   ' }],
      ['location', { ...validPayload, location: '   ' }],
    ])('returns 400 identifying the missing field "%s"', async (field, payload) => {
      const response = await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${ownerToken('owner-42')}`)
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain(`"${field}"`);
      expect(stored).toHaveLength(0);
    });

    it('ignores an ownerId sent in the body and keeps the token subject', async () => {
      const response = await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${ownerToken('owner-real')}`)
        .send({ ...validPayload, ownerId: 'owner-fake', id: 'venue-fake', unknown: 'ignored' })
        .expect(201);

      expect(response.body.ownerId).toBe('owner-real');
      expect(response.body.id).not.toBe('venue-fake');
      expect(stored).toHaveLength(1);
      expect(stored[0].ownerId).toBe('owner-real');
    });

    it('returns 401 without a token', async () => {
      await request(app).post('/venues').send(validPayload).expect(401);
      expect(stored).toHaveLength(0);
    });

    it('returns 401 when the Authorization header is not a Bearer token', async () => {
      await request(app)
        .post('/venues')
        .set('Authorization', ownerToken('owner-42'))
        .send(validPayload)
        .expect(401);
    });

    it('returns 401 for a tampered token', async () => {
      const forged = tamper(ownerToken('owner-42'), (payload) => {
        payload[claims.role] = roles.VENUE_OWNER;
        payload[claims.subject] = 'owner-hacker';
      });

      await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${forged}`)
        .send(validPayload)
        .expect(401);
      expect(stored).toHaveLength(0);
    });

    it('returns 401 for a token signed with another secret', async () => {
      const foreign = jwt.sign({ [claims.role]: roles.VENUE_OWNER }, 'another-secret', {
        algorithm: AUTH_CONFIG.algorithm,
        subject: 'owner-42',
        expiresIn: '1h',
      });

      await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${foreign}`)
        .send(validPayload)
        .expect(401);
    });

    it('returns 401 for an expired token', async () => {
      const expired = token(roles.VENUE_OWNER, 'owner-42', { expiresIn: -60 });

      await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${expired}`)
        .send(validPayload)
        .expect(401);
      expect(stored).toHaveLength(0);
    });

    it('returns 403 for a valid ORGANIZER token', async () => {
      const response = await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${organizerToken('organizer-7')}`)
        .send(validPayload)
        .expect(403);

      expect(response.body.error).toContain(roles.ORGANIZER);
      expect(stored).toHaveLength(0);
    });
  });

  describe('GET /venues', () => {
    it('lists venues of every owner right after they are created', async () => {
      await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${ownerToken('owner-a')}`)
        .send({ ...validPayload, name: 'Auditorio A' })
        .expect(201);

      await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${ownerToken('owner-b')}`)
        .send({ ...validPayload, name: 'Auditorio B' })
        .expect(201);

      const response = await request(app)
        .get('/venues')
        .set('Authorization', `Bearer ${organizerToken('organizer-9')}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((venue: { ownerId: string }) => venue.ownerId).sort()).toEqual([
        'owner-a',
        'owner-b',
      ]);
    });

    it('returns 401 without a token', async () => {
      await request(app).get('/venues').expect(401);
    });

    it('returns 401 for an expired token', async () => {
      const expired = token(roles.ORGANIZER, 'organizer-9', { expiresIn: -60 });

      await request(app)
        .get('/venues')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });
  });

  describe('GET /venues/:id', () => {
    it('returns the venue when it exists', async () => {
      const created = await request(app)
        .post('/venues')
        .set('Authorization', `Bearer ${ownerToken('owner-42')}`)
        .send(validPayload)
        .expect(201);

      const response = await request(app)
        .get(`/venues/${created.body.id}`)
        .set('Authorization', `Bearer ${organizerToken('organizer-9')}`)
        .expect(200);

      expect(response.body).toEqual(created.body);
    });

    it('returns 404 for an unknown venue', async () => {
      const response = await request(app)
        .get('/venues/does-not-exist')
        .set('Authorization', `Bearer ${ownerToken('owner-42')}`)
        .expect(404);

      expect(response.body.error).toContain('does-not-exist');
    });

    it('returns 401 without a token', async () => {
      await request(app).get('/venues/any-id').expect(401);
    });
  });
});

export {};