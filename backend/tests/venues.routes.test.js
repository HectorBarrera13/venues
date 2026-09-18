const request = require('supertest');
const app = require('../src/app');
const { venueRepository } = require('../src/repositories/VenueRepository');
const Venue = require('../src/entities/Venue');

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
