import {
  serializeVenueSearchHit,
  VenueReadController,
} from '../../src/controllers/VenueReadController';
import ApiError from '../../src/errors/ApiError';
import { buildVenue } from '../helpers/venues';

function mockResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('VenueReadController', () => {
  let service: { searchVenues: jest.Mock; getVenueById: jest.Mock };
  let controller: VenueReadController;
  let res: ReturnType<typeof mockResponse>;
  let next: jest.Mock;

  beforeEach(() => {
    service = { searchVenues: jest.fn(), getVenueById: jest.fn() };
    controller = new VenueReadController(service);
    res = mockResponse();
    next = jest.fn();
  });

  describe('serializeVenueSearchHit', () => {
    it('omits distance_km for non-geo results and preserves 0 for exact coordinate matches', () => {
      const venue = buildVenue({ latestMapVersion: 1 });

      const nonGeo = serializeVenueSearchHit({ venue });
      expect('distance_km' in nonGeo).toBe(false);

      const zeroDistance = serializeVenueSearchHit({ venue, distanceKm: 0 });
      expect(zeroDistance.distance_km).toBe(0);

      const withDistance = serializeVenueSearchHit({ venue, distanceKm: 4.12 });
      expect(withDistance.distance_km).toBe(4.12);
    });
  });

  describe('list', () => {
    it('passes req.query to searchVenues and serializes hits with pagination', async () => {
      const venue = buildVenue({ latestMapVersion: 2 });
      const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
      service.searchVenues.mockResolvedValue({
        data: [{ venue, distanceKm: 1.5 }],
        pagination,
      });

      await controller.list({ query: { lat: '19.4', lng: '-99.1', radius_km: '5' } } as any, res as any, next);

      expect(service.searchVenues).toHaveBeenCalledWith({ lat: '19.4', lng: '-99.1', radius_km: '5' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: [{ ...venue.toJSON(), distance_km: 1.5 }],
        pagination,
      });
    });

    it('forwards errors to next without writing response', async () => {
      const error = ApiError.badRequest('Invalid coordinates or radius');
      service.searchVenues.mockRejectedValue(error);

      await controller.list({ query: {} } as any, res as any, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns 200 with venue JSON (including latestMapVersion, without map geometry)', async () => {
      const venue = buildVenue({ latestMapVersion: 0 });
      service.getVenueById.mockResolvedValue(venue);

      await controller.getById({ params: { id: 'venue-1' } } as any, res as any, next);

      expect(service.getVenueById).toHaveBeenCalledWith('venue-1');
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toEqual(venue.toJSON());
      expect(body).not.toHaveProperty('stage');
      expect(body).not.toHaveProperty('zones');
      expect(body).not.toHaveProperty('seats');
    });

    it('forwards 404 to next', async () => {
      const error = ApiError.notFound('Venue "missing" not found');
      service.getVenueById.mockRejectedValue(error);

      await controller.getById({ params: { id: 'missing' } } as any, res as any, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
