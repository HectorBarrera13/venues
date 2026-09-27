const Venue = require('../src/entities/Venue');

describe('Venue Entity (Task 1)', () => {
  it('should initialize with provided properties and generate id and createdAt', () => {
    const venue = new Venue(
      'Grand Ballroom',
      'A beautiful ballroom for galas',
      'Av. Reforma 123, CDMX',
      'owner-42'
    );

    expect(venue.id).toBeDefined();
    expect(typeof venue.id).toBe('string');
    expect(venue.name).toBe('Grand Ballroom');
    expect(venue.description).toBe('A beautiful ballroom for galas');
    expect(venue.location).toBe('Av. Reforma 123, CDMX');
    expect(venue.ownerId).toBe('owner-42');
    expect(venue.createdAt).toBeDefined();
    expect(new Date(venue.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('should support initialization via options object', () => {
    const venue = new Venue({
      id: 'custom-id',
      name: 'Rooftop Lounge',
      description: 'Scenic views',
      location: 'Colonia Roma, CDMX',
      ownerId: 'owner-99',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(venue.id).toBe('custom-id');
    expect(venue.name).toBe('Rooftop Lounge');
    expect(venue.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  describe('belongsTo', () => {
    it('should return true when userId matches ownerId', () => {
      const venue = new Venue('Salon A', 'Desc', 'Loc', 'user-100');
      expect(venue.belongsTo('user-100')).toBe(true);
    });

    it('should return false when userId does not match ownerId', () => {
      const venue = new Venue('Salon A', 'Desc', 'Loc', 'user-100');
      expect(venue.belongsTo('user-200')).toBe(false);
      expect(venue.belongsTo(null)).toBe(false);
      expect(venue.belongsTo(undefined)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should expose the expected properties in JSON serialization', () => {
      const venue = new Venue({
        id: 'venue-1',
        name: 'Garden Terrace',
        description: 'Outdoor space',
        location: 'Polanco',
        ownerId: 'owner-1',
        createdAt: '2026-09-18T10:00:00.000Z',
      });

      const json = venue.toJSON();
      expect(json).toEqual({
        id: 'venue-1',
        name: 'Garden Terrace',
        description: 'Outdoor space',
        location: 'Polanco',
        ownerId: 'owner-1',
        createdAt: '2026-09-18T10:00:00.000Z',
      });
    });
  });
});
