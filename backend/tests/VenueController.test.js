const { VenueController } = require('../src/controllers/VenueController');

describe('VenueController.list (Task 5)', () => {
  let mockVenueService;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    mockVenueService = {
      listVenues: jest.fn(),
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
