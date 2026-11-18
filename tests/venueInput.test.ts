import { isIsoCountryCode, parseCreateVenue, parseListVenuesQuery } from '../src/validation/venueInput';
import { validVenuePayload } from './helpers/venues';

describe('parseCreateVenue', () => {
  it('trims text, upper-cases the country and nulls missing optionals', () => {
    expect(parseCreateVenue({ ...validVenuePayload, name: '  Foro Indie ', country: 'mx', description: '  ' })).toEqual({
      name: 'Foro Indie',
      description: null,
      address: validVenuePayload.address,
      city: validVenuePayload.city,
      country: 'MX',
      location: validVenuePayload.location,
      externalId: null,
      externalSource: null,
      osmRef: null,
    });
  });

  it('keeps geocoder references', () => {
    const command = parseCreateVenue({
      ...validVenuePayload,
      externalId: '282893735',
      externalSource: 'nominatim',
      osmRef: 'relation:4508',
    });
    expect(command).toMatchObject({ externalId: '282893735', externalSource: 'nominatim', osmRef: 'relation:4508' });
  });

  it('rejects a non-object body', () => {
    expect(() => parseCreateVenue(undefined)).toThrow('Field "name" is required');
  });

  it('rejects overly long text', () => {
    expect(() => parseCreateVenue({ ...validVenuePayload, name: 'x'.repeat(201) })).toThrow('at most 200');
  });
});

describe('isIsoCountryCode', () => {
  it.each(['MX', 'us', 'ES', 'XK'])('accepts %s', (code) => expect(isIsoCountryCode(code)).toBe(true));
  it.each(['XX', 'ZZ', 'QQ', 'MEX', 'M1', ''])('rejects %s', (code) => expect(isIsoCountryCode(code)).toBe(false));
});

describe('parseListVenuesQuery', () => {
  it('applies defaults', () => {
    expect(parseListVenuesQuery({})).toEqual({ page: 1, limit: 20, filters: {} });
  });

  it('parses every filter', () => {
    expect(parseListVenuesQuery({
      page: '2', limit: '50', lat: '19.43', lng: '-99.13', radius_km: '5', country: 'mx', city: 'CDMX', name: 'foro',
    })).toEqual({
      page: 2,
      limit: 50,
      filters: { near: { lat: 19.43, lng: -99.13, radiusKm: 5 }, country: 'MX', city: 'CDMX', name: 'foro' },
    });
  });

  it.each([
    ['page', { page: '0' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '101' }],
    ['limit', { limit: 'ten' }],
    ['radius_km', { lat: '1', lng: '1' }],
    ['radius_km', { lat: '1', lng: '1', radius_km: '0' }],
    ['radius_km', { lat: '1', lng: '1', radius_km: '501' }],
    ['lat', { lat: '95', lng: '1', radius_km: '1' }],
    ['lng', { lat: '1', lng: 'abc', radius_km: '1' }],
    ['country', { country: 'XX' }],
    ['city', { city: ['a', 'b'] }],
    ['name', { name: ' ' }],
  ])('rejects an invalid "%s"', (field, query) => {
    expect(() => parseListVenuesQuery(query)).toThrow(`"${field}"`);
  });
});
