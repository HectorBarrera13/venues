const { VenueRepository } = require('../src/repositories/VenueRepository');
const Venue = require('../src/entities/Venue').default;

const record = {
  id: 'venue-1',
  name: 'Auditorium',
  description: 'Concert hall',
  location: 'Centro',
  ownerId: 'owner-1',
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
};

describe('VenueRepository', () => {
  let client;
  let repository;

  beforeEach(() => {
    client = {
      venueOwner: { upsert: jest.fn().mockResolvedValue({ id: 'owner-1', name: 'owner-1' }) },
      venue: {
        upsert: jest.fn().mockResolvedValue(record),
        findMany: jest.fn().mockResolvedValue([record]),
        findUnique: jest.fn().mockResolvedValue(record),
      },
    };
    repository = new VenueRepository(client);
  });

  it('saves a venue and creates its owner record when needed', async () => {
    const venue = new Venue({ ...record, createdAt: record.createdAt });
    const saved = await repository.save(venue, 'Alex Morgan');

    expect(client.venueOwner.upsert).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      create: { id: 'owner-1', name: 'Alex Morgan' },
      update: { name: 'Alex Morgan' },
    });
    expect(client.venue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'venue-1' },
      create: expect.objectContaining({
        name: 'Auditorium',
        owner: { connect: { id: 'owner-1' } },
      }),
    }));
    expect(saved).toBeInstanceOf(Venue);
    expect(saved.toJSON()).toEqual({ ...record, createdAt: record.createdAt.toISOString() });
  });

  it('updates an existing venue by ID', async () => {
    await repository.save(new Venue({ ...record, name: 'Auditorium Deluxe' }));

    expect(client.venue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'venue-1' },
      update: expect.objectContaining({ name: 'Auditorium Deluxe' }),
    }));
  });

  it('lists venues from MongoDB as domain entities', async () => {
    const venues = await repository.findAll();

    expect(client.venue.findMany).toHaveBeenCalledTimes(1);
    expect(venues).toHaveLength(1);
    expect(venues[0]).toBeInstanceOf(Venue);
    expect(venues[0].createdAt).toBe('2026-10-01T12:00:00.000Z');
  });

  it('finds a venue by ID', async () => {
    const venue = await repository.findById('venue-1');

    expect(client.venue.findUnique).toHaveBeenCalledWith({ where: { id: 'venue-1' } });
    expect(venue).toBeInstanceOf(Venue);
  });

  it('returns null when no venue has the requested ID', async () => {
    client.venue.findUnique.mockResolvedValue(null);

    await expect(repository.findById('missing')).resolves.toBeNull();
  });
});
