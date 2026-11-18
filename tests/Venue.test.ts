import Venue, { fromGeoPoint, normalizeVenueName, toGeoPoint } from '../src/entities/Venue';
import { buildVenue } from './helpers/venues';

describe('Venue entity', () => {
  it('generates id and createdAt and defaults optional fields', () => {
    const venue = new Venue({
      name: 'Grand Ballroom',
      address: 'Av. Reforma 123',
      city: 'CDMX',
      country: 'mx',
      location: { lat: 19.43, lng: -99.13 },
      ownerId: 'owner-42',
    });

    expect(typeof venue.id).toBe('string');
    expect(venue.id.length).toBeGreaterThan(0);
    expect(new Date(venue.createdAt).toString()).not.toBe('Invalid Date');
    expect(venue.country).toBe('MX');
    expect(venue.description).toBeNull();
    expect(venue.externalId).toBeNull();
    expect(venue.externalSource).toBeNull();
    expect(venue.osmRef).toBeNull();
    expect(venue.latestMapVersion).toBe(0);
  });

  it('derives nameNormalized from the name', () => {
    expect(buildVenue({ name: '  Estadio  Azteca—Ciudad de México ' }).nameNormalized)
      .toBe('estadio azteca ciudad de mexico');
  });

  it('converts its location to a GeoJSON Point with [lng, lat] order', () => {
    expect(buildVenue().toGeoPoint()).toEqual({ type: 'Point', coordinates: [-99.1951, 19.4245] });
  });

  it('round-trips between lat/lng and GeoJSON', () => {
    const location = { lat: -33.8568, lng: 151.2153 };
    expect(fromGeoPoint(toGeoPoint(location))).toEqual(location);
  });

  it('normalizes accents, case and punctuation', () => {
    expect(normalizeVenueName("L'Olympia Bruno Coquatrix")).toBe('l olympia bruno coquatrix');
    expect(normalizeVenueName('ÁRENA   CDMX')).toBe('arena cdmx');
  });

  describe('belongsTo', () => {
    it('matches only the owner id', () => {
      const venue = buildVenue({ ownerId: 'user-100' });
      expect(venue.belongsTo('user-100')).toBe(true);
      expect(venue.belongsTo('user-200')).toBe(false);
      expect(venue.belongsTo(null)).toBe(false);
      expect(venue.belongsTo(undefined)).toBe(false);
    });
  });

  it('serializes the public contract without internal fields', () => {
    expect(buildVenue({ osmRef: 'way:42', externalId: '9001', externalSource: 'nominatim' }).toJSON()).toEqual({
      id: 'venue-1',
      name: 'Auditorio Nacional',
      description: 'Concert hall',
      address: 'Paseo de la Reforma 50',
      city: 'Ciudad de Mexico',
      country: 'MX',
      location: { lat: 19.4245, lng: -99.1951 },
      externalId: '9001',
      externalSource: 'nominatim',
      osmRef: 'way:42',
      latestMapVersion: 0,
      ownerId: 'owner-1',
      createdAt: '2026-10-01T12:00:00.000Z',
    });
  });
});
