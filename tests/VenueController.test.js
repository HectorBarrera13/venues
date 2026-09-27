const { VenueController } = require('../src/controllers/VenueController');
const ApiError = require('../src/errors/ApiError');

describe('VenueController.list (Task 5)', () => {
  let mockVenueService;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    mockVenueService = {
      listVenues: jest.fn(),
      registerVenue: jest.fn(),
    };
    controller = new VenueController(mockVenueService);
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should call venueService.listVenues and return 200 with JSON', async () => {
    const rawVenue = {
      id: '1',
      name: 'Expo Center',
      toJSON: jest.fn().mockReturnValue({ id: '1', name: 'Expo Center (serialized)' }),
    };
    mockVenueService.listVenues.mockResolvedValue([rawVenue]);

    await controller.list(req, res, next);

    expect(mockVenueService.listVenues).toHaveBeenCalledTimes(1);
    expect(rawVenue.toJSON).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: '1', name: 'Expo Center (serialized)' }]);
  });

  it('should handle venues that do not have a toJSON method gracefully', async () => {
    const plainVenue = { id: '2', name: 'Plain Venue' };
    mockVenueService.listVenues.mockResolvedValue([plainVenue]);

    await controller.list(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([plainVenue]);
  });

  it('should call next with error if service throws', async () => {
    const error = new Error('Database failure');
    mockVenueService.listVenues.mockRejectedValue(error);

    await controller.list(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should respond with 500 status if error occurs and next is not provided', async () => {
    const error = new Error('Unexpected crash');
    mockVenueService.listVenues.mockRejectedValue(error);

    await controller.list(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unexpected crash' });
  });
});

describe('VenueController.create (Task 2)', () => {
  let mockVenueService;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    mockVenueService = {
      listVenues: jest.fn(),
      registerVenue: jest.fn(),
    };
    controller = new VenueController(mockVenueService);
    req = {
      body: {
        name: 'Palacio de los Deportes',
        description: 'Indoor arena',
        location: 'Iztacalco',
      },
      user: { id: 'user-42' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should call venueService.registerVenue with req.body and req.user and return 201 with serialized JSON', async () => {
    const mockCreatedVenue = {
      id: 'venue-10',
      name: 'Palacio de los Deportes',
      description: 'Indoor arena',
      location: 'Iztacalco',
      ownerId: 'user-42',
      createdAt: '2026-09-18T10:00:00.000Z',
      toJSON: jest.fn().mockReturnValue({
        id: 'venue-10',
        name: 'Palacio de los Deportes',
        description: 'Indoor arena',
        location: 'Iztacalco',
        ownerId: 'user-42',
        createdAt: '2026-09-18T10:00:00.000Z',
      }),
    };
    mockVenueService.registerVenue.mockResolvedValue(mockCreatedVenue);

    await controller.create(req, res, next);

    expect(mockVenueService.registerVenue).toHaveBeenCalledWith(req.body, req.user);
    expect(mockCreatedVenue.toJSON).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 'venue-10',
      name: 'Palacio de los Deportes',
      description: 'Indoor arena',
      location: 'Iztacalco',
      ownerId: 'user-42',
      createdAt: '2026-09-18T10:00:00.000Z',
    });
  });

  it('should handle venues that do not have toJSON method gracefully', async () => {
    const plainVenue = {
      id: 'venue-20',
      name: 'Plain Stage',
      location: 'Condesa',
    };
    mockVenueService.registerVenue.mockResolvedValue(plainVenue);

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(plainVenue);
  });

  it('should call next with error when registerVenue throws and next is provided', async () => {
    const apiError = ApiError.badRequest('Venue name is required');
    mockVenueService.registerVenue.mockRejectedValue(apiError);

    await controller.create(req, res, next);

    expect(next).toHaveBeenCalledWith(apiError);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should respond with error status when registerVenue throws ApiError and next is not provided', async () => {
    const apiError = ApiError.forbidden('User does not have venue owner permissions');
    mockVenueService.registerVenue.mockRejectedValue(apiError);

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'User does not have venue owner permissions' });
  });

  it('should respond with 500 when registerVenue throws generic error and next is not provided', async () => {
    const genericError = new Error('Unexpected database failure');
    mockVenueService.registerVenue.mockRejectedValue(genericError);

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unexpected database failure' });
  });
});
