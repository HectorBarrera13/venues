const { VenueRepository } = require('../src/repositories/VenueRepository');

describe('VenueRepository (Tasks 6 & 17)', () => {
  let repository;

  beforeEach(() => {
    repository = new VenueRepository();
  });

  describe('Task 17: Initialization & reset', () => {
    it('should initialize with an empty array by default', () => {
      expect(repository.findAll()).toEqual([]);
    });

    it('should initialize with provided seed venues if passed to constructor', () => {
      const initial = [{ id: '1', name: 'Venue 1' }];
      const customRepo = new VenueRepository(initial);
      expect(customRepo.findAll()).toEqual(initial);
    });

    it('should reset the internal array to empty by default', () => {
      repository.save({ id: 'v-1', name: 'Venue 1' });
      expect(repository.findAll().length).toBe(1);

      repository.reset();
      expect(repository.findAll()).toEqual([]);
    });

    it('should reset the internal array with new seed data when provided', () => {
      repository.save({ id: 'v-1', name: 'Venue 1' });

      const newSeed = [{ id: 'v-2', name: 'Venue 2' }];
      repository.reset(newSeed);

      expect(repository.findAll()).toEqual(newSeed);
    });
  });

  describe('Task 6: save', () => {
    it('should add a new venue and return it', () => {
      const venue = { id: 'v-10', name: 'Auditorium' };
      const saved = repository.save(venue);

      expect(saved).toBe(venue);
      expect(repository.findAll()).toHaveLength(1);
      expect(repository.findById('v-10')).toBe(venue);
    });

    it('should update an existing venue if the id already exists', () => {
      const venue = { id: 'v-10', name: 'Auditorium' };
      repository.save(venue);

      const updatedVenue = { id: 'v-10', name: 'Auditorium Deluxe' };
      repository.save(updatedVenue);

      expect(repository.findAll()).toHaveLength(1);
      expect(repository.findById('v-10').name).toBe('Auditorium Deluxe');
    });

    it('should throw an error if saving null or undefined', () => {
      expect(() => repository.save(null)).toThrow('Venue cannot be null or undefined');
      expect(() => repository.save(undefined)).toThrow('Venue cannot be null or undefined');
    });
  });

  describe('Task 6: findAll', () => {
    it('should return all venues', () => {
      const v1 = { id: '1', name: 'Venue A' };
      const v2 = { id: '2', name: 'Venue B' };
      repository.save(v1);
      repository.save(v2);

      const all = repository.findAll();
      expect(all).toEqual([v1, v2]);
    });

    it('should return a shallow copy to prevent external array mutations', () => {
      const v1 = { id: '1', name: 'Venue A' };
      repository.save(v1);

      const all = repository.findAll();
      all.push({ id: '2', name: 'Venue B' });

      expect(repository.findAll()).toHaveLength(1);
    });
  });

  describe('Task 6: findById', () => {
    it('should return the venue with matching id', () => {
      const venue = { id: 'v-find', name: 'Match' };
      repository.save(venue);

      expect(repository.findById('v-find')).toBe(venue);
    });

    it('should return null when no venue matches the id', () => {
      expect(repository.findById('non-existent')).toBeNull();
    });
  });
});
