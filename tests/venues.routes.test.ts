import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { AUTH_CONFIG } from '../src/auth/authConfig';
import ApiError from '../src/errors/ApiError';
import { venueRepository } from '../src/repositories/VenueRepository';
import { venueService } from '../src/services/VenueService';
import { buildVenue, validVenuePayload } from './helpers/venues';

const TEST_SECRET = 'integration-test-secret';
process.env.JWT_SECRET = TEST_SECRET;

function authToken(role: string): string {
  return `Bearer ${jwt.sign({ [AUTH_CONFIG.claims.role]: role }, TEST_SECRET, {
    algorithm: AUTH_CONFIG.algorithm,
    subject: 'route-test-user',
    expiresIn: '1h',
  })}`;
}

const OWNER_AUTHORIZATION = authToken(AUTH_CONFIG.roles.VENUE_OWNER);
const ORGANIZER_AUTHORIZATION = authToken(AUTH_CONFIG.roles.ORGANIZER);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /venues', () => {
  it('returns an empty page when no venues exist', async () => {
    jest.spyOn(venueRepository, 'findPage').mockResolvedValue({ items: [], total: 0 });

    const response = await request(app)
      .get('/venues')
      .set('Authorization', ORGANIZER_AUTHORIZATION)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('serializes each venue of the requested page', async () => {
    const venues = [buildVenue({ id: 'v-101' }), buildVenue({ id: 'v-102', name: 'Foro Sol' })];
    const findPage = jest.spyOn(venueRepository, 'findPage').mockResolvedValue({ items: venues, total: 4 });

    const response = await request(app)
      .get('/venues?page=2&limit=2')
      .set('Authorization', ORGANIZER_AUTHORIZATION)
      .expect(200);

    expect(findPage).toHaveBeenCalledWith({ skip: 2, take: 2 });
    expect(response.body).toEqual({
      data: venues.map((venue) => venue.toJSON()),
      pagination: { page: 2, limit: 2, total: 4, totalPages: 2 },
    });
  });

  it('answers 400 for invalid query parameters', async () => {
    const response = await request(app)
      .get('/venues?lat=19.4')
      .set('Authorization', ORGANIZER_AUTHORIZATION)
      .expect(400);

    expect(response.body.error).toContain('radius_km');
  });

  it('answers 501 for search filters until search is implemented', async () => {
    await request(app)
      .get('/venues?country=MX&city=Monterrey')
      .set('Authorization', ORGANIZER_AUTHORIZATION)
      .expect(501);
  });

  it('also responds at /api/venues for frontend proxy compatibility', async () => {
    jest.spyOn(venueRepository, 'findPage').mockResolvedValue({ items: [], total: 0 });

    const response = await request(app).get('/api/venues').set('Authorization', ORGANIZER_AUTHORIZATION).expect(200);

    expect(response.body.data).toEqual([]);
  });
});

describe('POST /venues', () => {
  it('returns 201 with the serialized venue', async () => {
    const created = buildVenue({ id: 'venue-999' });
    jest.spyOn(venueService, 'registerVenue').mockResolvedValue(created);

    const response = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_AUTHORIZATION)
      .send(validVenuePayload)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toEqual(created.toJSON());
  });

  it('returns 409 with existingVenueId for a duplicate osmRef', async () => {
    jest.spyOn(venueService, 'registerVenue').mockRejectedValue(
      ApiError.conflict('A venue with osmRef "way:42" already exists', { existingVenueId: 'venue-1' })
    );

    const response = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_AUTHORIZATION)
      .send({ ...validVenuePayload, osmRef: 'way:42' })
      .expect(409);

    expect(response.body).toEqual({
      error: 'A venue with osmRef "way:42" already exists',
      existingVenueId: 'venue-1',
    });
  });

  it('returns 500 when registration fails unexpectedly', async () => {
    jest.spyOn(venueService, 'registerVenue').mockRejectedValue(new Error('Database disconnected'));

    const response = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_AUTHORIZATION)
      .send(validVenuePayload)
      .expect(500);

    expect(response.body).toEqual({ error: 'Database disconnected' });
  });

  it('also responds at /api/venues for frontend proxy compatibility', async () => {
    jest.spyOn(venueService, 'registerVenue').mockResolvedValue(buildVenue({ id: 'venue-proxy' }));

    const response = await request(app)
      .post('/api/venues')
      .set('Authorization', OWNER_AUTHORIZATION)
      .send(validVenuePayload)
      .expect(201);

    expect(response.body.id).toBe('venue-proxy');
  });
});
