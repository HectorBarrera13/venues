const { venueService: defaultVenueService } = require('../services/VenueService');

/**
 * VenueController
 * 
 * Handles HTTP requests related to venues.
 */
class VenueController {
  /**
   * @param {object} venueService
   */
  constructor(venueService = defaultVenueService) {
    this.venueService = venueService;
    this.list = this.list.bind(this);
  }

  /**
   * Task 5: VenueController.list
   * Calls VenueService.listVenues() and returns the array of venues as JSON (using each one's toJSON()).
   * 
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} [next] - Express next middleware
   */
  async list(req, res, next) {
    try {
      const venues = await this.venueService.listVenues();
      const venuesJson = venues.map((venue) =>
        typeof venue?.toJSON === 'function' ? venue.toJSON() : venue
      );
      return res.status(200).json(venuesJson);
    } catch (error) {
      if (typeof next === 'function') {
        return next(error);
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Task 2 (P1): create(req, res) will be implemented by P1
}

const venueController = new VenueController();

module.exports = {
  VenueController,
  venueController,
};
