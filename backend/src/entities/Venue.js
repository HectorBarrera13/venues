const crypto = require('crypto');

class Venue {
  /**
   * Venue entity constructor.
   * Accepts positional parameters (name, description, location, ownerId)
   * or an object with entity properties.
   */
  constructor(nameOrProps, description, location, ownerId) {
    if (typeof nameOrProps === 'object' && nameOrProps !== null) {
      const { id, name, description: desc, location: loc, ownerId: owner, createdAt } = nameOrProps;
      this.id = id || crypto.randomUUID();
      this.name = name;
      this.description = desc;
      this.location = loc;
      this.ownerId = owner;
      this.createdAt = createdAt || new Date().toISOString();
    } else {
      this.id = crypto.randomUUID();
      this.name = nameOrProps;
      this.description = description;
      this.location = location;
      this.ownerId = ownerId;
      this.createdAt = new Date().toISOString();
    }
  }

  /**
   * Check if this venue belongs to a specific user.
   * @param {string} userId
   * @returns {boolean}
   */
  belongsTo(userId) {
    return Boolean(userId && this.ownerId === userId);
  }

  /**
   * Control what is exposed in JSON responses.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      location: this.location,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
    };
  }
}

module.exports = Venue;
