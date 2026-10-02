import request from 'supertest';
import { SignJWT } from 'jose';
import app from '../src/app';
import { venueRepository } from '../src/repositories/VenueRepository';
import { venueService } from '../src/services/VenueService';
import Venue from '../src/entities/Venue';
import ApiError from '../src/errors/ApiError';
import { authConfig } from '../src/auth/authConfig';
import { Roles } from '../src/auth/roles';

describe('Public Endpoints (Task 5 & Health)', () => {
  let findAllSpy: jest.SpyInstance;

  beforeEach(() => {
    findAllSpy = jest.spyOn(venueRepository, 'findAll').mockResolvedValue([]);
  });

  afterEach(() => {
    findAllSpy.mockRestore();
  });

  it('GET /health should return 200 without token', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /venues should return 200 without token (public endpoint)', async () => {
    const response = await request(app)
      .get('/venues')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('GET /venues should return all venues serialized when venues exist', async () => {
    const v1 = new Venue({
      id: 'v-101',
      name: 'Auditorio Nacional',
      description: 'Concert hall',
      location: 'Paseo de la Reforma',
      ownerId: 'owner-1',
      createdAt: '2026-03-01T12:00:00.000Z',
    });
    const v2 = new Venue({
      id: 'v-102',
      name: 'Foro Sol',
      description: 'Stadium',
      location: 'Iztacalco',
      ownerId: 'owner-2',
      createdAt: '2026-03-02T12:00:00.000Z',
    });

    findAllSpy.mockResolvedValue([v1, v2]);

    const response = await request(app)
      .get('/venues')
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual([
      {
        id: 'v-101',
        name: 'Auditorio Nacional',
        description: 'Concert hall',
        location: 'Paseo de la Reforma',
        ownerId: 'owner-1',
        createdAt: '2026-03-01T12:00:00.000Z',
      },
      {
        id: 'v-102',
        name: 'Foro Sol',
        description: 'Stadium',
        location: 'Iztacalco',
        ownerId: 'owner-2',
        createdAt: '2026-03-02T12:00:00.000Z',
      },
    ]);
  });

  it('GET /api/venues should also respond with 200 without token for frontend proxy compatibility', async () => {
    const response = await request(app)
      .get('/api/venues')
      .expect(200);

    expect(response.body).toEqual([]);
  });
});

describe('POST /venues & POST /api/venues Authentication & Authorization (Phases 19-20)', () => {
  const secretKey = new TextEncoder().encode(authConfig.secret || 'test-secret-venue-service-at-least-32-chars-long!');
  let registerVenueSpy: jest.SpyInstance;

  afterEach(() => {
    if (registerVenueSpy) {
      registerVenueSpy.mockRestore();
    }
  });

  async function createTestToken(options: {
    sub?: string;
    roles?: string[];
    iat?: number;
    exp?: number;
    secret?: Uint8Array;
  } = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const jwt = new SignJWT({
      sub: options.sub ?? 'jwt-owner-456',
      roles: options.roles ?? [Roles.VENUE_OWNER],
    }).setProtectedHeader({ alg: 'HS256' });

    jwt.setIssuedAt(options.iat ?? now);
    jwt.setExpirationTime(options.exp ?? now + 3600);

    return jwt.sign(options.secret || secretKey);
  }

  it('POST /venues without token should return 401 Unauthorized', async () => {
    const response = await request(app)
      .post('/venues')
      .send({ name: 'Arena CDMX', description: 'Major arena', location: 'Azcapotzalco' })
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toHaveProperty('error');
  });

  it('POST /venues with invalid token should return 401 Unauthorized', async () => {
    const response = await request(app)
      .post('/venues')
      .set('Authorization', 'Bearer invalid-token-string')
      .send({ name: 'Arena CDMX', description: 'Major arena', location: 'Azcapotzalco' })
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toHaveProperty('error');
  });

  it('POST /venues with expired token should return 401 Unauthorized', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await createTestToken({
      iat: now - 7200,
      exp: now - 3600,
    });

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ name: 'Arena CDMX', description: 'Major arena', location: 'Azcapotzalco' })
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toHaveProperty('error');
  });

  it('POST /venues with token older than 8 hours should return 401 Unauthorized', async () => {
    const now = Math.floor(Date.now() / 1000);
    const oldToken = await createTestToken({
      iat: now - 9 * 3600, // 9 hours old
      exp: now + 3600, // but exp not expired yet
    });

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ name: 'Arena CDMX', description: 'Major arena', location: 'Azcapotzalco' })
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body.error).toMatch(/8 hours/i);
  });

  it('POST /venues with ORGANIZER role should return 403 Forbidden', async () => {
    const organizerToken = await createTestToken({
      sub: 'organizer-user-1',
      roles: [Roles.ORGANIZER],
    });

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Secret Arena', description: 'Arena', location: 'CDMX' })
      .expect(403);

    expect(response.body).toEqual({ error: 'Forbidden' });
  });

  it('POST /venues with FAN role should return 403 Forbidden', async () => {
    const fanToken = await createTestToken({
      sub: 'fan-user-1',
      roles: [Roles.FAN],
    });

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ name: 'Secret Arena', description: 'Arena', location: 'CDMX' })
      .expect(403);

    expect(response.body).toEqual({ error: 'Forbidden' });
  });

  it('POST /venues with VENUE_OWNER role should return 201 and attribute ownerId from JWT userId', async () => {
    const token = await createTestToken({
      sub: 'authenticated-owner-789',
      roles: [Roles.VENUE_OWNER],
    });

    const mockCreatedVenue = new Venue({
      id: 'venue-999',
      name: 'Arena CDMX',
      description: 'Major venue',
      location: 'Azcapotzalco',
      ownerId: 'authenticated-owner-789',
      createdAt: '2026-09-18T12:00:00.000Z',
    });

    registerVenueSpy = jest.spyOn(venueService, 'registerVenue').mockImplementation(async (_data, principal) => {
      expect(principal).toBeDefined();
      expect(principal?.userId).toBe('authenticated-owner-789');
      expect(principal?.roles).toContain(Roles.VENUE_OWNER);
      return mockCreatedVenue;
    });

    const payload = {
      name: 'Arena CDMX',
      description: 'Major venue',
      location: 'Azcapotzalco',
    };

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({
      id: 'venue-999',
      name: 'Arena CDMX',
      description: 'Major venue',
      location: 'Azcapotzalco',
      ownerId: 'authenticated-owner-789',
      createdAt: '2026-09-18T12:00:00.000Z',
    });
    // Explicitly assert ownerId matches JWT userId
    expect(response.body.ownerId).toBe('authenticated-owner-789');
  });

  it('POST /venues with ownerId in request body should return 400 Bad Request', async () => {
    const token = await createTestToken({ sub: 'legit-owner' });

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Arena CDMX',
        description: 'Major venue',
        location: 'Azcapotzalco',
        ownerId: 'hacked-owner-id',
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'Injecting ownerId or authorId is not allowed' });
  });

  it('POST /venues with authorId in request body should return 400 Bad Request', async () => {
    const token = await createTestToken({ sub: 'legit-owner' });

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Arena CDMX',
        description: 'Major venue',
        location: 'Azcapotzalco',
        authorId: 'hacked-author-id',
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'Injecting ownerId or authorId is not allowed' });
  });

  it('POST /api/venues should also require authentication and return 201 for valid VENUE_OWNER token', async () => {
    const token = await createTestToken({ sub: 'proxy-owner' });
    const mockCreatedVenue = new Venue({
      id: 'venue-proxy',
      name: 'Teatro Metropolitan',
      description: 'Art deco theatre',
      location: 'Centro',
      ownerId: 'proxy-owner',
      createdAt: '2026-09-18T12:00:00.000Z',
    });

    registerVenueSpy = jest.spyOn(venueService, 'registerVenue').mockResolvedValue(mockCreatedVenue);

    const response = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Teatro Metropolitan',
        description: 'Art deco theatre',
        location: 'Centro',
      })
      .expect(201);

    expect(response.body.id).toBe('venue-proxy');
    expect(response.body.ownerId).toBe('proxy-owner');
  });

  it('POST /venues should return 400 when registerVenue throws ApiError.badRequest', async () => {
    const token = await createTestToken();
    registerVenueSpy = jest
      .spyOn(venueService, 'registerVenue')
      .mockRejectedValue(ApiError.badRequest('Field "name" is required'));

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No name', location: 'Loc' })
      .expect(400);

    expect(response.body).toEqual({ error: 'Field "name" is required' });
  });

  it('POST /venues should return 500 when registerVenue throws unexpected error', async () => {
    const token = await createTestToken();
    registerVenueSpy = jest
      .spyOn(venueService, 'registerVenue')
      .mockRejectedValue(new Error('Database disconnected'));

    const response = await request(app)
      .post('/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Club', description: 'Desc', location: 'Loc' })
      .expect(500);

    expect(response.body).toEqual({ error: 'Database disconnected' });
  });
});
