import { VenueService } from '../src/services/VenueService';
import Venue from '../src/entities/Venue';
import ApiError from '../src/errors/ApiError';
import { Roles } from '../src/auth/roles';
import type { AuthenticatedPrincipal } from '../src/auth/AuthenticatedPrincipal';

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

  describe('registerVenue', () => {
    let mockRepository: {
      findAll: jest.Mock;
      save: jest.Mock;
      findById: jest.Mock;
    };
    let service: VenueService;

    beforeEach(() => {
      mockRepository = {
        findAll: jest.fn(),
        save: jest.fn(async (venue) => venue),
        findById: jest.fn(),
      };
      service = new VenueService(mockRepository);
    });

    // ── success path ──────────────────────────────────────────────────────────

    it('should register venue using principal.userId when valid VENUE_OWNER principal is provided', async () => {
      const payload = {
        name: 'Foro Indie',
        description: 'Indie venue',
        location: 'Roma Norte',
      };
      const principal: AuthenticatedPrincipal = {
        userId: 'user-789',
        roles: [Roles.VENUE_OWNER],
      };

      const result = await service.registerVenue(payload, principal);

      expect(result).toBeInstanceOf(Venue);
      expect(result.ownerId).toBe('user-789');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    // ── 403 path ──────────────────────────────────────────────────────────────

    it('should throw 403 when principal is not provided', async () => {
      const payload = {
        name: 'Teatro Metropolitan',
        description: 'Historic theatre',
        location: 'Centro Historico',
      };

      const error = await service.registerVenue(payload).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
    });

    it('should throw 403 when principal has empty roles array', async () => {
      const payload = {
        name: 'Auditorio Sala B',
        description: 'Acoustic hall',
        location: 'Polanco',
      };
      const principal: AuthenticatedPrincipal = { userId: 'legacy-id-45', roles: [] };

      const error = await service.registerVenue(payload, principal).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
    });

    it('should throw 403 when principal is absent even if ownerId supplied in data', async () => {
      const payload = {
        name: 'Open Air Stadium',
        description: 'Large arena',
        location: 'Tlalpan',
      };

      const error = await service.registerVenue(payload).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
    });

    it('should throw 403 when principal does not contain VENUE_OWNER role', async () => {
      const payload = {
        name: 'Community Center',
        description: 'Multi-purpose room',
        location: 'Coyoacan',
      };
      const nonOwnerPrincipal: AuthenticatedPrincipal = {
        userId: 'user-organizer',
        roles: [Roles.ORGANIZER],
      };

      const error = await service.registerVenue(payload, nonOwnerPrincipal).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
    });

    // ── 400 path ──────────────────────────────────────────────────────────────

    it('should throw ApiError(400) if name is missing or empty', async () => {
      const payload = {
        name: '   ',
        description: 'Desc',
        location: 'Loc',
      };
      const principal: AuthenticatedPrincipal = {
        userId: 'user-789',
        roles: [Roles.VENUE_OWNER],
      };

      await expect(service.registerVenue(payload, principal)).rejects.toThrow(ApiError);
      await expect(service.registerVenue(payload, principal)).rejects.toThrow('Field "name" is required');
    });

    it('should throw ApiError(400) if description is missing or empty', async () => {
      const payload = {
        name: 'Valid Name',
        description: '',
        location: 'Loc',
      };
      const principal: AuthenticatedPrincipal = {
        userId: 'user-789',
        roles: [Roles.VENUE_OWNER],
      };

      await expect(service.registerVenue(payload, principal)).rejects.toThrow(ApiError);
      await expect(service.registerVenue(payload, principal)).rejects.toThrow('Field "description" is required');
    });

    it('should throw ApiError(400) if location is missing or empty', async () => {
      const payload = {
        name: 'Valid Name',
        description: 'Valid Desc',
      };
      const principal: AuthenticatedPrincipal = {
        userId: 'user-789',
        roles: [Roles.VENUE_OWNER],
      };

      await expect(service.registerVenue(payload, principal)).rejects.toThrow(ApiError);
      await expect(service.registerVenue(payload, principal)).rejects.toThrow('Field "location" is required');
    });
  });
});

export {};
