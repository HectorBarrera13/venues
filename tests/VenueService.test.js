const { VenueService } = require('../src/services/VenueService');
const Venue = require('../src/entities/Venue');
const ApiError = require('../src/errors/ApiError');

describe('VenueService', () => {
  describe('listVenues', () => {
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

  describe('registerVenue', () => {
    let mockRepository;
    let service;

    beforeEach(() => {
      mockRepository = {
        findAll: jest.fn(),
        save: jest.fn((venue) => venue),
      };
      service = new VenueService(mockRepository);
    });

    it('should register venue without currentUser and default ownerId to venue-owner-1', () => {
      const payload = {
        name: 'Teatro Metropolitan',
        description: 'Historic theatre',
        location: 'Centro Historico',
      };

      const result = service.registerVenue(payload);

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedVenue = mockRepository.save.mock.calls[0][0];
      expect(savedVenue).toBeInstanceOf(Venue);
      expect(savedVenue.name).toBe('Teatro Metropolitan');
      expect(savedVenue.description).toBe('Historic theatre');
      expect(savedVenue.location).toBe('Centro Historico');
      expect(savedVenue.ownerId).toBe('venue-owner-1');
      expect(result).toBe(savedVenue);
    });

    it('should register venue using currentUser.userId when provided', () => {
      const payload = {
        name: 'Foro Indie',
        description: 'Indie venue',
        location: 'Roma Norte',
      };
      const currentUser = { userId: 'user-789', role: 'venue_owner' };

      const result = service.registerVenue(payload, currentUser);

      expect(result.ownerId).toBe('user-789');
    });

    it('should register venue using currentUser.id when userId is absent', () => {
      const payload = {
        name: 'Auditorio Sala B',
        description: 'Acoustic hall',
        location: 'Polanco',
      };
      const currentUser = { id: 'legacy-id-45' };

      const result = service.registerVenue(payload, currentUser);

      expect(result.ownerId).toBe('legacy-id-45');
    });

    it('should register venue using data.ownerId when no currentUser is provided', () => {
      const payload = {
        name: 'Open Air Stadium',
        description: 'Large arena',
        location: 'Tlalpan',
        ownerId: 'explicit-owner-99',
      };

      const result = service.registerVenue(payload);

      expect(result.ownerId).toBe('explicit-owner-99');
    });

    it('should not throw 403 when user is not a venue_owner (allows unauthenticated / organizer)', () => {
      const payload = {
        name: 'Community Center',
        description: 'Multi-purpose room',
        location: 'Coyoacan',
      };
      const nonOwnerUser = { userId: 'user-organizer', role: 'organizer' };

      expect(() => service.registerVenue(payload, nonOwnerUser)).not.toThrow();
    });

    it('should throw ApiError(400) if name is missing or empty', () => {
      const payload = {
        name: '   ',
        description: 'Desc',
        location: 'Loc',
      };

      expect(() => service.registerVenue(payload)).toThrow(ApiError);
      expect(() => service.registerVenue(payload)).toThrow('Field "name" is required');
    });

    it('should throw ApiError(400) if description is missing or empty', () => {
      const payload = {
        name: 'Valid Name',
        description: '',
        location: 'Loc',
      };

      expect(() => service.registerVenue(payload)).toThrow(ApiError);
      expect(() => service.registerVenue(payload)).toThrow('Field "description" is required');
    });

    it('should throw ApiError(400) if location is missing or empty', () => {
      const payload = {
        name: 'Valid Name',
        description: 'Valid Desc',
      };

      expect(() => service.registerVenue(payload)).toThrow(ApiError);
      expect(() => service.registerVenue(payload)).toThrow('Field "location" is required');
    });
  });
});
