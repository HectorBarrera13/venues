import { VenueService } from '../src/services/VenueService';
import Venue from '../src/entities/Venue';
import ApiError from '../src/errors/ApiError';
import { buildVenue, validVenuePayload } from './helpers/venues';

const owner = { userId: 'user-789', role: 'venue_owner', name: 'Alex' };

function mockRepository() {
  return {
    save: jest.fn(async (venue: Venue) => venue),
    findPage: jest.fn(),
    search: jest.fn(),
    findById: jest.fn(),
    findByOsmRef: jest.fn().mockResolvedValue(null),
  };
}

describe('VenueService', () => {
  let repository: ReturnType<typeof mockRepository>;
  let service: VenueService;

  beforeEach(() => {
    repository = mockRepository();
    service = new VenueService(repository);
  });

  describe('listVenues', () => {
    it('returns the first page with pagination metadata by default', async () => {
      const venues = [buildVenue()];
      repository.findPage.mockResolvedValue({ items: venues, total: 45 });

      const result = await service.listVenues({});

      expect(repository.findPage).toHaveBeenCalledWith({ skip: 0, take: 20 });
      expect(result).toEqual({ data: venues, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } });
    });

    it('translates page and limit into skip and take', async () => {
      repository.findPage.mockResolvedValue({ items: [], total: 0 });

      const result = await service.listVenues({ page: '3', limit: '10' });

      expect(repository.findPage).toHaveBeenCalledWith({ skip: 20, take: 10 });
      expect(result.pagination).toEqual({ page: 3, limit: 10, total: 0, totalPages: 0 });
    });

    it('rejects invalid pagination with 400', async () => {
      await expect(service.listVenues({ limit: '500' })).rejects.toMatchObject({ status: 400 });
      expect(repository.findPage).not.toHaveBeenCalled();
    });

    it('delegates filtered queries to repository.search', async () => {
      const venue = buildVenue({ latestMapVersion: 1 });
      repository.search.mockResolvedValue({ items: [{ venue }], total: 1 });

      const result = await service.listVenues({ country: 'mx' });

      expect(repository.search).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        filters: { country: 'MX' },
      });
      expect(repository.findPage).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: [venue],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });
  });

  describe('getVenueById', () => {
    it('returns the venue when it exists', async () => {
      const venue = buildVenue();
      repository.findById.mockResolvedValue(venue);

      await expect(service.getVenueById('venue-1')).resolves.toBe(venue);
      expect(repository.findById).toHaveBeenCalledWith('venue-1');
    });

    it('throws 404 when the venue does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const error = await service.getVenueById('missing').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });
  });

  describe('venueExists', () => {
    it('is true only when the repository finds the venue', async () => {
      repository.findById.mockResolvedValueOnce(buildVenue()).mockResolvedValueOnce(null);

      await expect(service.venueExists('venue-1')).resolves.toBe(true);
      await expect(service.venueExists('missing')).resolves.toBe(false);
    });
  });

  describe('registerVenue', () => {
    it('creates the venue for the token subject', async () => {
      const result = await service.registerVenue(validVenuePayload, owner);

      expect(result).toBeInstanceOf(Venue);
      expect(result.ownerId).toBe('user-789');
      expect(result.location).toEqual(validVenuePayload.location);
      expect(result.latestMapVersion).toBe(0);
      expect(repository.save).toHaveBeenCalledWith(result, 'Alex');
    });

    it.each([
      ['no user', undefined],
      ['a user without role', { userId: 'legacy' }],
      ['an organizer', { userId: 'user-organizer', role: 'organizer' }],
    ])('throws 403 for %s', async (_label, user) => {
      const error = await service.registerVenue(validVenuePayload, user).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(403);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws 400 before saving when the body is invalid', async () => {
      await expect(service.registerVenue({ ...validVenuePayload, name: '  ' }, owner))
        .rejects.toThrow('Field "name" is required');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws 409 with existingVenueId when the osmRef is already registered', async () => {
      repository.findByOsmRef.mockResolvedValue(buildVenue({ id: 'venue-existing', osmRef: 'way:42' }));

      const error = await service.registerVenue({ ...validVenuePayload, osmRef: 'way:42' }, owner).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(409);
      expect(error.details).toEqual({ existingVenueId: 'venue-existing' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws 409 when a concurrent insert wins the unique osmRef index', async () => {
      repository.findByOsmRef
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(buildVenue({ id: 'venue-winner', osmRef: 'way:42' }));
      repository.save.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

      const error = await service.registerVenue({ ...validVenuePayload, osmRef: 'way:42' }, owner).catch((e) => e);

      expect(error.status).toBe(409);
      expect(error.details).toEqual({ existingVenueId: 'venue-winner' });
    });

    it('rethrows storage failures that are not osmRef conflicts', async () => {
      const failure = new Error('Database down');
      repository.save.mockRejectedValue(failure);

      await expect(service.registerVenue(validVenuePayload, owner)).rejects.toBe(failure);
    });
  });
});
