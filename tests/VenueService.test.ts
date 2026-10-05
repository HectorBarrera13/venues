import { VenueService } from '../src/services/VenueService';
import Venue from '../src/entities/Venue';
import ApiError from '../src/errors/ApiError';

describe('VenueService', () => {
  describe('listVenues', () => {
    it('should call venueRepository.findAll when listVenues is called', async () => {
      const mockVenues = [
        { id: 'v-1', name: 'Venue 1' },
        { id: 'v-2', name: 'Venue 2' },
      ];
      const mockRepository = {
        findAll: jest.fn().mockResolvedValue(mockVenues),
        save: jest.fn(),
        findById: jest.fn(),
      };

      const service = new VenueService(mockRepository);
      const result = await service.listVenues();

      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockVenues);
    });
  });

  describe('getVenueById', () => {
    it('should return the venue when it exists', async () => {
      const venue = new Venue({ id: 'v-1', name: 'Venue 1', description: 'D', location: 'L', ownerId: 'o-1' });
      const mockRepository = { findAll: jest.fn(), save: jest.fn(), findById: jest.fn().mockResolvedValue(venue) };

      const result = await new VenueService(mockRepository).getVenueById('v-1');

      expect(mockRepository.findById).toHaveBeenCalledWith('v-1');
      expect(result).toBe(venue);
    });

    it('should throw 404 when the venue does not exist', async () => {
      const mockRepository = { findAll: jest.fn(), save: jest.fn(), findById: jest.fn().mockResolvedValue(null) };

      const error = await new VenueService(mockRepository).getVenueById('missing').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });
  });

  describe('venueExists', () => {
    it('should resolve to true only when the repository finds the venue', async () => {
      const findById = jest.fn().mockResolvedValueOnce(new Venue('Venue 1', 'D', 'L', 'o-1')).mockResolvedValueOnce(null);
      const mockRepository = { findAll: jest.fn(), save: jest.fn(), findById };

      const service = new VenueService(mockRepository);

      await expect(service.venueExists('v-1')).resolves.toBe(true);
      await expect(service.venueExists('missing')).resolves.toBe(false);
    });
  });

  describe('registerVenue', () => {
    let mockRepository;
    let service;

    beforeEach(() => {
      mockRepository = {
        findAll: jest.fn(),
        save: jest.fn(async (venue) => venue),
      };
      service = new VenueService(mockRepository);
    });

    // ── success path ──────────────────────────────────────────────────────────

    it('should register venue using currentUser.userId when provided', async () => {
      const payload = {
        name: 'Foro Indie',
        description: 'Indie venue',
        location: 'Roma Norte',
      };
      const currentUser = { userId: 'user-789', role: 'venue_owner' };

      const result = await service.registerVenue(payload, currentUser);

      expect(result).toBeInstanceOf(Venue);
      expect(result.ownerId).toBe('user-789');
    });

    // ── 403 path ──────────────────────────────────────────────────────────────

    it('should throw 403 when currentUser is not provided', async () => {
      const payload = {
        name: 'Teatro Metropolitan',
        description: 'Historic theatre',
        location: 'Centro Historico',
      };

      const error = await service.registerVenue(payload).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(403);
    });

    it('should throw 403 when currentUser has no role', async () => {
      const payload = {
        name: 'Auditorio Sala B',
        description: 'Acoustic hall',
        location: 'Polanco',
      };
      const currentUser = { id: 'legacy-id-45' };

      const error = await service.registerVenue(payload, currentUser).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(403);
    });

    it('should throw 403 when currentUser is absent even if ownerId supplied in data', async () => {
      const payload = {
        name: 'Open Air Stadium',
        description: 'Large arena',
        location: 'Tlalpan',
      };

      const error = await service.registerVenue(payload).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(403);
    });

    it('should throw 403 when currentUser.role is not venue_owner', async () => {
      const payload = {
        name: 'Community Center',
        description: 'Multi-purpose room',
        location: 'Coyoacan',
      };
      const nonOwnerUser = { userId: 'user-organizer', role: 'organizer' };

      const error = await service.registerVenue(payload, nonOwnerUser).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(403);
    });

    // ── 400 path ──────────────────────────────────────────────────────────────

    it('should throw ApiError(400) if name is missing or empty', async () => {
      const payload = {
        name: '   ',
        description: 'Desc',
        location: 'Loc',
      };

      await expect(service.registerVenue(payload)).rejects.toThrow(ApiError);
      await expect(service.registerVenue(payload)).rejects.toThrow('Field "name" is required');
    });

    it('should throw ApiError(400) if description is missing or empty', async () => {
      const payload = {
        name: 'Valid Name',
        description: '',
        location: 'Loc',
      };

      await expect(service.registerVenue(payload)).rejects.toThrow(ApiError);
      await expect(service.registerVenue(payload)).rejects.toThrow('Field "description" is required');
    });

    it('should throw ApiError(400) if location is missing or empty', async () => {
      const payload = {
        name: 'Valid Name',
        description: 'Valid Desc',
      };

      await expect(service.registerVenue(payload)).rejects.toThrow(ApiError);
      await expect(service.registerVenue(payload)).rejects.toThrow('Field "location" is required');
    });
  });
});

export {};
