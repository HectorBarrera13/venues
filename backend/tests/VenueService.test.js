const { VenueService } = require('../src/services/VenueService');

describe('VenueService', () => {
  it('should call venueRepository.findAll when listVenues is called', () => {
    const mockVenues = [
      { id: 'v-1', name: 'Venue 1' },
      { id: 'v-2', name: 'Venue 2' },
    ];
    const mockRepository = {
      findAll: jest.fn().mockReturnValue(mockVenues),
    };

    const service = new VenueService(mockRepository);
    const result = service.listVenues();

    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockVenues);
  });
});
