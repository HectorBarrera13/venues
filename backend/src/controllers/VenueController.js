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
    this.create = this.create.bind(this);
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

  /**
   * Task 2: VenueController.create
   * Calls VenueService.registerVenue(req.body, req.user) and returns 201 with serialized venue JSON.
   * 
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} [next] - Express next middleware
   */
  async create(req, res, next) {
    try {
      const venue = await this.venueService.registerVenue(req.body, req.user);
      const venueJson = typeof venue?.toJSON === 'function' ? venue.toJSON() : venue;
      return res.status(201).json(venueJson);
    } catch (error) {
      if (typeof next === 'function') {
        return next(error);
      }
      return res.status(error.statusCode || error.status || 500).json({ error: error.message });
    }
  }
}

const venueController = new VenueController();

module.exports = {
  VenueController,
  venueController,
};
