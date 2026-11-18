import { VenueController } from '../src/controllers/VenueController';
import ApiError from '../src/errors/ApiError';
import { buildVenue, validVenuePayload } from './helpers/venues';

function mockResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('VenueController', () => {
  let service: { listVenues: jest.Mock; registerVenue: jest.Mock; getVenueById: jest.Mock };
  let controller: VenueController;
  let res: ReturnType<typeof mockResponse>;
  let next: jest.Mock;

  beforeEach(() => {
    service = { listVenues: jest.fn(), registerVenue: jest.fn(), getVenueById: jest.fn() };
    controller = new VenueController(service as any);
    res = mockResponse();
    next = jest.fn();
  });

  describe('list', () => {
    it('passes the query to the service and renders { data, pagination }', async () => {
      const venue = buildVenue();
      const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
      service.listVenues.mockResolvedValue({ data: [venue], pagination });

      await controller.list({ query: { page: '1' } } as any, res as any, next);

      expect(service.listVenues).toHaveBeenCalledWith({ page: '1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: [venue.toJSON()], pagination });
    });

    it('forwards errors to the error handler without rendering', async () => {
      const error = new Error('Database failure');
      service.listVenues.mockRejectedValue(error);

      await controller.list({ query: {} } as any, res as any, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('renders the venue', async () => {
      const venue = buildVenue();
      service.getVenueById.mockResolvedValue(venue);

      await controller.getById({ params: { id: 'venue-1' } } as any, res as any, next);

      expect(service.getVenueById).toHaveBeenCalledWith('venue-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(venue.toJSON());
    });

    it('forwards a 404 to the error handler', async () => {
      const error = ApiError.notFound();
      service.getVenueById.mockRejectedValue(error);

      await controller.getById({ params: { id: 'x' } } as any, res as any, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('create', () => {
    it('registers the body for the authenticated user and answers 201', async () => {
      const venue = buildVenue();
      service.registerVenue.mockResolvedValue(venue);
      const req = { body: validVenuePayload, user: { userId: 'owner-1', role: 'VENUE_OWNER' } };

      await controller.create(req as any, res as any, next);

      expect(service.registerVenue).toHaveBeenCalledWith(req.body, req.user);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(venue.toJSON());
    });

    it('forwards service errors to the error handler without rendering', async () => {
      const error = ApiError.badRequest('Field "name" is required');
      service.registerVenue.mockRejectedValue(error);

      await controller.create({ body: {} } as any, res as any, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
