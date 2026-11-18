import { VenueRepository } from '../src/repositories/VenueRepository';
import Venue from '../src/entities/Venue';
import { buildVenue } from './helpers/venues';

const record = {
  id: 'venue-1',
  name: 'Auditorio Nacional',
  nameNormalized: 'auditorio nacional',
  description: 'Concert hall',
  address: 'Paseo de la Reforma 50',
  city: 'Ciudad de Mexico',
  country: 'MX',
  location: { type: 'Point', coordinates: [-99.1951, 19.4245] },
  externalId: null,
  externalSource: null,
  osmRef: 'way:42',
  latestMapVersion: 3,
  ownerId: 'owner-1',
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
};

describe('VenueRepository', () => {
  let client: any;
  let repository: VenueRepository;

  beforeEach(() => {
    client = {
      venueOwner: { upsert: jest.fn().mockResolvedValue({ id: 'owner-1', name: 'owner-1' }) },
      venue: {
        upsert: jest.fn().mockResolvedValue(record),
        findMany: jest.fn().mockResolvedValue([record]),
        count: jest.fn().mockResolvedValue(41),
        findUnique: jest.fn().mockResolvedValue(record),
        findFirst: jest.fn().mockResolvedValue(record),
        aggregateRaw: jest.fn().mockResolvedValue([{ items: [], meta: [] }]),
      },
    };
    repository = new VenueRepository(client);
  });

  it('upserts the owner and stores the location as a GeoJSON Point', async () => {
    const saved = await repository.save(buildVenue({ osmRef: 'way:42' }), 'Alex Morgan');

    expect(client.venueOwner.upsert).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      create: { id: 'owner-1', name: 'Alex Morgan' },
      update: { name: 'Alex Morgan' },
    });
    const call = client.venue.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'venue-1' });
    expect(call.create).toMatchObject({
      nameNormalized: 'auditorio nacional',
      location: { type: 'Point', coordinates: [-99.1951, 19.4245] },
      latestMapVersion: 0,
      owner: { connect: { id: 'owner-1' } },
    });
    expect(call.update).not.toHaveProperty('latestMapVersion');
    expect(saved).toBeInstanceOf(Venue);
    expect(saved.location).toEqual({ lat: 19.4245, lng: -99.1951 });
    expect(saved.latestMapVersion).toBe(3);
  });

  it('reads one page of mapped venues and the total count', async () => {
    const page = await repository.findPage({ skip: 20, take: 20 });

    expect(client.venue.findMany).toHaveBeenCalledWith({
      where: { latestMapVersion: { gte: 1 } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    });
    expect(client.venue.count).toHaveBeenCalledWith({
      where: { latestMapVersion: { gte: 1 } },
    });
    expect(page.total).toBe(41);
    expect(page.items[0]).toBeInstanceOf(Venue);
    expect(page.items[0].createdAt).toBe('2026-10-01T12:00:00.000Z');
  });

  it('finds a venue by id', async () => {
    const venue = await repository.findById('venue-1');

    expect(client.venue.findUnique).toHaveBeenCalledWith({ where: { id: 'venue-1' } });
    expect(venue).toBeInstanceOf(Venue);
  });

  it('returns null when no venue has the requested id', async () => {
    client.venue.findUnique.mockResolvedValue(null);
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('finds a venue by osmRef', async () => {
    const venue = await repository.findByOsmRef('way:42');

    expect(client.venue.findFirst).toHaveBeenCalledWith({ where: { osmRef: 'way:42' } });
    expect(venue?.osmRef).toBe('way:42');
  });

  it('returns null when no venue has the osmRef', async () => {
    client.venue.findFirst.mockResolvedValue(null);
    await expect(repository.findByOsmRef('node:1')).resolves.toBeNull();
  });

  describe('findDuplicate', () => {
    it('queries by normalized name and matches coordinates rounded to 4 decimals', async () => {
      const venue = await repository.findDuplicate({ nameNormalized: 'auditorio nacional', lat: 19.42452, lng: -99.19508 });

      expect(client.venue.findMany).toHaveBeenCalledWith({ where: { nameNormalized: 'auditorio nacional' } });
      expect(venue?.id).toBe('venue-1');
    });

    it('does not match the same name at a different position', async () => {
      await expect(repository.findDuplicate({ nameNormalized: 'auditorio nacional', lat: 19.4246, lng: -99.1951 }))
        .resolves.toBeNull();
    });
  });
});
