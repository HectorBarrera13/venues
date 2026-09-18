const { venueRepository: defaultVenueRepository } = require('../repositories/VenueRepository');
const Venue = require('../entities/Venue');
const ApiError = require('../errors/ApiError');

/**
 * VenueService
 *
 * Encapsulates business logic for venue management.
 * Depends on VenueRepository for persistence; all other code should
 * interact with venues through this service, not the repository directly.
 */
class VenueService {
  /**
   * @param {object} venueRepository - Repository instance (injected for testability)
   */
  constructor(venueRepository = defaultVenueRepository) {
    this.venueRepository = venueRepository;
  }

  /**
   * List all venues (Task 5).
   *
   * @returns {Venue[]} All persisted venues
   */
  listVenues() {
    return this.venueRepository.findAll();
  }

  /**
   * Register a new venue (Task 4).
   *
   * Validates required fields, then delegates persistence to the repository.
   * Resolves ownerId from currentUser if provided, falling back to a default owner.
   *
   * @param {{ name: string, description: string, location: string, ownerId?: string }} data
   * @param {{ userId?: string, id?: string, role?: string }} [currentUser]
   * @returns {Venue} The newly saved venue
   * @throws {ApiError} 400 if name, description, or location is empty
   */
  registerVenue(data, currentUser) {
    for (const field of ['name', 'description', 'location']) {
      const val = data?.[field];
      if (!val || !String(val).trim()) {
        throw new ApiError(400, `Field "${field}" is required`);
      }
    }

    const { name, description, location } = data;
    const ownerId = currentUser?.userId || currentUser?.id || data?.ownerId || 'venue-owner-1';
    const venue = new Venue(name.trim(), description.trim(), location.trim(), ownerId);
    return this.venueRepository.save(venue);
  }
}

const venueService = new VenueService();

module.exports = {
  VenueService,
  venueService,
};
