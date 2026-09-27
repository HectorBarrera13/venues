const request = require('supertest');
const app = require('../src/app');
const { venueRepository } = require('../src/repositories/VenueRepository');
const { venueService } = require('../src/services/VenueService');
const Venue = require('../src/entities/Venue');
const ApiError = require('../src/errors/ApiError');

describe('GET /venues Route Integration (Task 5)', () => {
  beforeEach(() => {
    venueRepository.reset();
  });

  it('should return 200 with an empty array when no venues exist', async () => {
    const response = await request(app)
      .get('/venues')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should return 200 with all venues using toJSON() serialization', async () => {
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

    venueRepository.save(v1);
    venueRepository.save(v2);

    const response = await request(app)
      .get('/venues')
      .expect('Content-Type', /json/)
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

  it('should also respond at /api/venues for frontend proxy compatibility', async () => {
    const response = await request(app)
      .get('/api/venues')
      .expect(200);

    expect(response.body).toEqual([]);
  });
});

describe('POST /venues Route Integration (Task 2 & 7)', () => {
  let registerVenueSpy;

  afterEach(() => {
    if (registerVenueSpy) {
      registerVenueSpy.mockRestore();
    }
  });

  it('should return 201 with serialized venue JSON when created successfully', async () => {
    const mockCreatedVenue = new Venue({
      id: 'venue-999',
      name: 'Arena CDMX',
      description: 'Major venue',
      location: 'Azcapotzalco',
      ownerId: 'owner-123',
      createdAt: '2026-09-18T12:00:00.000Z',
    });

    registerVenueSpy = jest.spyOn(venueService, 'registerVenue').mockResolvedValue(mockCreatedVenue);

    const payload = {
      name: 'Arena CDMX',
      description: 'Major venue',
      location: 'Azcapotzalco',
    };

    const response = await request(app)
      .post('/venues')
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toEqual({
      id: 'venue-999',
      name: 'Arena CDMX',
      description: 'Major venue',
      location: 'Azcapotzalco',
      ownerId: 'owner-123',
      createdAt: '2026-09-18T12:00:00.000Z',
    });
  });

  it('should return 400 when registerVenue throws ApiError.badRequest', async () => {
    registerVenueSpy = jest
      .spyOn(venueService, 'registerVenue')
      .mockRejectedValue(ApiError.badRequest('Name is required'));

    const response = await request(app)
      .post('/venues')
      .send({})
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toEqual({ error: 'Name is required' });
  });

  it('should return 403 when registerVenue throws ApiError.forbidden', async () => {
    registerVenueSpy = jest
      .spyOn(venueService, 'registerVenue')
      .mockRejectedValue(ApiError.forbidden('Venue owner required'));

    const response = await request(app)
      .post('/venues')
      .send({ name: 'Secret Club' })
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toEqual({ error: 'Venue owner required' });
  });

  it('should return 500 when registerVenue throws generic error', async () => {
    registerVenueSpy = jest
      .spyOn(venueService, 'registerVenue')
      .mockRejectedValue(new Error('Database disconnected'));

    const response = await request(app)
      .post('/venues')
      .send({ name: 'Club' })
      .expect('Content-Type', /json/)
      .expect(500);

    expect(response.body).toEqual({ error: 'Database disconnected' });
  });

  it('should also respond at /api/venues for frontend proxy compatibility', async () => {
    const mockCreatedVenue = new Venue({
      id: 'venue-proxy',
      name: 'Teatro Metropolitan',
      description: 'Art deco theatre',
      location: 'Centro',
      ownerId: 'owner-proxy',
      createdAt: '2026-09-18T12:00:00.000Z',
    });

    registerVenueSpy = jest.spyOn(venueService, 'registerVenue').mockResolvedValue(mockCreatedVenue);

    const response = await request(app)
      .post('/api/venues')
      .send({ name: 'Teatro Metropolitan' })
      .expect(201);

    expect(response.body.id).toBe('venue-proxy');
  });
});
