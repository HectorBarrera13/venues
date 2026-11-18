import ApiError from '../src/errors/ApiError';
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

  function fieldErrors(body: unknown) {
    try {
      parseCreateVenue(body);
    } catch (error) {
      return error as ApiError;
    }
    throw new Error('expected parseCreateVenue to throw');
  }

  it('reports every required field of a non-object body at once', () => {
    const error = fieldErrors(undefined);
    expect(error.status).toBe(400);
    expect(error.details?.errors).toEqual([
      { field: 'name', message: 'Field "name" is required' },
      { field: 'address', message: 'Field "address" is required' },
      { field: 'city', message: 'Field "city" is required' },
      { field: 'country', message: 'Field "country" is required' },
      { field: 'location', message: 'Field "location" is required' },
    ]);
    expect(error.details).toMatchObject({ field: 'name', message: 'Field "name" is required' });
  });

  it('lists several invalid fields in one 400', () => {
    const error = fieldErrors({ ...validVenuePayload, city: ' ', country: 'ESPA', location: { lat: 95, lng: 181 } });
    expect((error.details?.errors as { field: string }[]).map((e) => e.field)).toEqual(['city', 'country', 'lat', 'lng']);
  });

  it.each([
    ['lat', { lat: 95, lng: 0 }],
    ['lat', { lat: '19.4', lng: 0 }],
    ['lng', { lat: 0, lng: 181 }],
    ['lng', { lat: 0 }],
  ])('attributes an invalid coordinate to "%s"', (field, location) => {
    expect(fieldErrors({ ...validVenuePayload, location }).details?.field).toBe(field);
  });

  it.each(['name', 'address', 'city', 'country'])('attributes an empty %s to its field', (field) => {
    expect(fieldErrors({ ...validVenuePayload, [field]: '  ' }).details?.field).toBe(field);
  });

  it('rejects a non-ISO country and accepts lower case', () => {
    expect(fieldErrors({ ...validVenuePayload, country: 'ESPA' }).details?.field).toBe('country');
    expect(parseCreateVenue({ ...validVenuePayload, country: 'es' }).country).toBe('ES');
  });

  it('rejects overly long text once, attributed to the field', () => {
    const error = fieldErrors({ ...validVenuePayload, name: 'x'.repeat(201) });
    expect(error.details?.errors).toEqual([{ field: 'name', message: 'Field "name" must be at most 200 characters' }]);
  });

  it('rejects a malformed osmRef', () => {
    expect(fieldErrors({ ...validVenuePayload, osmRef: 'node-1' }).details?.field).toBe('osmRef');
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
