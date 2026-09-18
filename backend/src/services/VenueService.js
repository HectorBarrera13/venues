const { venueRepository: defaultVenueRepository } = require('../repositories/VenueRepository');

/**
 * VenueService
 * 
 * Encapsulates business logic for venue management.
 */
class VenueService {
  /**
   * @param {object} venueRepository
   */
  constructor(venueRepository = defaultVenueRepository) {
    this.venueRepository = venueRepository;
  }

  /**
   * List all venues (Task 5).
   * @returns {Array} Array of venues
   */
  listVenues() {
    return this.venueRepository.findAll();
  }

  // Task 4 (P2): registerVenue(data, currentUser) will be implemented by P2
}

const venueService = new VenueService();

module.exports = {
  VenueService,
  venueService,
};
