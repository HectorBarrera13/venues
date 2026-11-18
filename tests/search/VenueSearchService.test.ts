import ApiError from '../../src/errors/ApiError';
import { VenueSearchService } from '../../src/services/VenueSearchService';
import { buildVenue } from '../helpers/venues';

function mockRepository() {
  return {
    findPage: jest.fn(),
    search: jest.fn(),
    findById: jest.fn(),
  };
}

describe('VenueSearchService', () => {
  let repository: ReturnType<typeof mockRepository>;
  let service: VenueSearchService;

  beforeEach(() => {
    repository = mockRepository();
    service = new VenueSearchService(repository);
  });

  describe('getVenueById (VEN-301)', () => {
    it('returns the venue including latestMapVersion: 0 when unmapped', async () => {
      const venue = buildVenue({ id: 'venue-unmapped', latestMapVersion: 0 });
      repository.findById.mockResolvedValue(venue);

      const result = await service.getVenueById('venue-unmapped');

      expect(result).toBe(venue);
      expect(result.latestMapVersion).toBe(0);
      expect(repository.findById).toHaveBeenCalledWith('venue-unmapped');
    });

    it('throws 404 when the venue does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const error = await service.getVenueById('unknown-id').catch((err) => err);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });
  });

  describe('searchVenues (VEN-302, VEN-306, VEN-307)', () => {
    it('uses findPage for unfiltered listing and ignores unknown query params', async () => {
      const venue = buildVenue({ latestMapVersion: 2 });
      repository.findPage.mockResolvedValue({ items: [venue], total: 45 });

      const result = await service.searchVenues({ page: '1', limit: '10', foo: 'bar', sort: 'ignored' });

      expect(repository.findPage).toHaveBeenCalledWith({ skip: 0, take: 10 });
      expect(repository.search).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: [{ venue }],
        pagination: { page: 1, limit: 10, total: 45, totalPages: 5 },
      });
    });

    it('uses search when any C5 filter is provided', async () => {
      const venue = buildVenue({ latestMapVersion: 1, country: 'ES', city: 'Madrid' });
      repository.search.mockResolvedValue({ items: [{ venue, distanceKm: 2.35 }], total: 1 });

      const result = await service.searchVenues({
        lat: '40.41',
        lng: '-3.70',
        radius_km: '20',
        country: 'es',
        city: 'Madrid',
        name: 'Riviera',
        page: '2',
        limit: '5',
      });

      expect(repository.search).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        filters: {
          near: { lat: 40.41, lng: -3.7, radiusKm: 20 },
          country: 'ES',
          city: 'Madrid',
          name: 'Riviera',
        },
      });
      expect(repository.findPage).not.toHaveBeenCalled();
      expect(result.data).toEqual([{ venue, distanceKm: 2.35 }]);
    });

    it('returns 200 shape with total: 0 and totalPages: 0 on zero matches', async () => {
      repository.search.mockResolvedValue({ items: [], total: 0 });

      const result = await service.searchVenues({ name: 'nonexistent' });

      expect(result).toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('returns empty data while preserving pagination when page exceeds totalPages', async () => {
      repository.findPage.mockResolvedValue({ items: [], total: 45 });

      const result = await service.searchVenues({ page: '6', limit: '10' });

      expect(result).toEqual({
        data: [],
        pagination: { page: 6, limit: 10, total: 45, totalPages: 5 },
      });
    });

    it('accepts boundary coordinates lat=90, lng=-180, radius_km=500', async () => {
      repository.search.mockResolvedValue({ items: [], total: 0 });

      await expect(
        service.searchVenues({ lat: '90', lng: '-180', radius_km: '500' })
      ).resolves.toMatchObject({ data: [] });

      expect(repository.search).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        filters: { near: { lat: 90, lng: -180, radiusKm: 500 } },
      });
    });

    it.each([
      { lat: '95', lng: '-0.37', radius_km: '-5' },
      { lat: '-91', lng: '0', radius_km: '10' },
      { lat: '10', lng: '181', radius_km: '10' },
      { lat: '10', lng: '-181', radius_km: '10' },
      { lat: '10', lng: '10', radius_km: '0' },
      { lat: '10', lng: '10', radius_km: '-5' },
      { lat: '10', lng: '10', radius_km: '501' },
      { lat: '10', lng: '10', radius_km: 'abc' },
      { lat: 'abc', lng: '10', radius_km: '10' },
      { lat: '10', lng: 'abc', radius_km: '10' },
      { lat: '', lng: '10', radius_km: '10' },
    ])('rejects invalid coordinates or radius %j with exact message before hitting DB', async (query) => {
      const error = await service.searchVenues(query).catch((err) => err);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
      expect(error.message).toBe('Invalid coordinates or radius');
      expect(repository.search).not.toHaveBeenCalled();
      expect(repository.findPage).not.toHaveBeenCalled();
    });

    it.each([
      { lat: '40.41' },
      { lat: '40.41', lng: '-3.70' },
      { radius_km: '10' },
      { page: '0' },
      { limit: '101' },
      { country: 'XX' },
    ])('rejects invalid query %j with 400 before touching repository', async (query) => {
      const error = await service.searchVenues(query).catch((err) => err);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
      expect(repository.search).not.toHaveBeenCalled();
      expect(repository.findPage).not.toHaveBeenCalled();
    });
  });
});
