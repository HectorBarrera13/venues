/**
 * VenueRepository
 * 
 * In-memory persistence for venues.
 * Covers Task 6 (save, findAll, findById) and Task 17 (internal array initialization and reset method).
 */
class VenueRepository {
  /**
   * Task 17: Set up the internal array.
   * @param {Array} initialVenues - Optional initial seed array.
   */
  constructor(initialVenues = []) {
    this.venues = [...initialVenues];
  }

  /**
   * Task 17: Reset the internal array (mock bootstrapping and test isolation).
   * @param {Array} initialVenues - Optional venues to replace the store with.
   */
  reset(initialVenues = []) {
    this.venues = [...initialVenues];
  }

  /**
   * Task 6: Save a venue to the repository.
   * If a venue with the same id exists, it will be updated; otherwise added.
   * @param {object} venue
   * @returns {object} The saved venue
   */
  save(venue) {
    if (!venue) {
      throw new Error('Venue cannot be null or undefined');
    }

    const index = this.venues.findIndex((v) => v.id === venue.id);
    if (index !== -1) {
      this.venues[index] = venue;
    } else {
      this.venues.push(venue);
    }
    return venue;
  }

  /**
   * Task 6: Retrieve all venues.
   * @returns {Array} Array of all venues
   */
  findAll() {
    return [...this.venues];
  }

  /**
   * Task 6: Find a venue by its ID.
   * @param {string} id
   * @returns {object|null} The matching venue or null if not found
   */
  findById(id) {
    const venue = this.venues.find((v) => v.id === id);
    return venue || null;
  }
}

const venueRepository = new VenueRepository();

module.exports = {
  VenueRepository,
  venueRepository,
};
