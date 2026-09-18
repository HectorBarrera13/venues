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
   * Validates role and required fields, then delegates persistence to the
   * repository. ownerId always comes from currentUser — never from the
   * request body — so a client cannot impersonate another owner.
   *
   * @param {{ name: string, description: string, location: string }} data
   * @param {{ userId: string, role: string }} currentUser
   * @returns {Venue} The newly saved venue
   * @throws {ApiError} 403 if currentUser is not a venue_owner
   * @throws {ApiError} 400 if name, description, or location is empty
   */
  registerVenue(data, currentUser) {
    if (currentUser?.role !== 'venue_owner') {
      throw new ApiError(403, 'Only venue owners can register venues');
    }

    for (const field of ['name', 'description', 'location']) {
      const val = data?.[field];
      if (!val || !String(val).trim()) {
        throw new ApiError(400, `Field "${field}" is required`);
      }
    }

    const { name, description, location } = data;
    const venue = new Venue(name.trim(), description.trim(), location.trim(), currentUser.userId);
    return this.venueRepository.save(venue);
  }
}

const venueService = new VenueService();

module.exports = {
  VenueService,
  venueService,
};
