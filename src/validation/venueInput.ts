import { isIsoCountryCode, validateVenueProps, type FieldError, type GeoLocation } from '../entities/Venue';
import ApiError from '../errors/ApiError';

/** Validated body of `POST /venues`. The owner always comes from the access token. */
export interface CreateVenueCommand {
  name: string;
  description: string | null;
  address: string;
  city: string;
  country: string;
  location: GeoLocation;
  externalId: string | null;
  externalSource: string | null;
  osmRef: string | null;
}

export interface VenueSearchFilters {
  near?: GeoLocation & { radiusKm: number };
  country?: string;
  city?: string;
  name?: string;
}

/** Validated query of `GET /venues`. */
export interface ListVenuesQuery {
  page: number;
  limit: number;
  filters: VenueSearchFilters;
}

export const PAGINATION = { defaultPage: 1, defaultLimit: 20, maxLimit: 100 } as const;
export const MAX_RADIUS_KM = 500;
export const MAX_TEXT_LENGTH = 200;
export const OSM_REF_PATTERN = /^(node|way|relation):[1-9]\d*$/;

export { isIsoCountryCode };

type Source = Record<string, unknown>;

function asSource(value: unknown): Source {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Source) : {};
}

/** Reads an optional text field; records a type/length problem and returns null when invalid. */
function text(source: Source, field: string, errors: FieldError[]): string | null {
  const value = source[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    errors.push({ field, message: `Field "${field}" must be a string` });
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TEXT_LENGTH) {
    errors.push({ field, message: `Field "${field}" must be at most ${MAX_TEXT_LENGTH} characters` });
    return null;
  }
  return trimmed;
}

function country(value: string, field: string): string {
  if (!isIsoCountryCode(value)) {
    throw ApiError.badRequest(`Field "${field}" must be an ISO 3166-1 alpha-2 country code`);
  }
  return value.toUpperCase();
}

function coordinate(value: unknown, field: string, limit: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    throw ApiError.badRequest(`Field "${field}" must be a number between -${limit} and ${limit}`);
  }
  return value;
}

/**
 * Validates the whole `POST /venues` body and reports every invalid field at once
 * as a 400 `{ error, field, message, errors }`.
 */
export function parseCreateVenue(body: unknown): CreateVenueCommand {
  const source = asSource(body);
  const errors: FieldError[] = [];

  const name = text(source, 'name', errors);
  const description = text(source, 'description', errors);
  const address = text(source, 'address', errors);
  const city = text(source, 'city', errors);
  const countryCode = text(source, 'country', errors);

  let location: Partial<GeoLocation> | undefined;
  if (source.location !== undefined && source.location !== null) {
    if (typeof source.location !== 'object' || Array.isArray(source.location)) {
      errors.push({ field: 'location', message: 'Field "location" must be an object with "lat" and "lng"' });
    } else {
      const raw = asSource(source.location);
      location = { lat: raw.lat as number, lng: raw.lng as number };
    }
  }

  const typeErrorFields = new Set(errors.map((error) => error.field));
  for (const error of validateVenueProps({
    name: name ?? '', address: address ?? '', city: city ?? '', country: countryCode ?? '',
    location: location as GeoLocation | undefined,
  })) {
    // A field already reported for its type/length is not reported again as missing.
    if (!typeErrorFields.has(error.field)) errors.push(error);
  }

  const externalId = text(source, 'externalId', errors);
  const externalSource = text(source, 'externalSource', errors);
  if (externalId && !externalSource) {
    errors.push({ field: 'externalSource', message: 'Field "externalSource" is required when "externalId" is present' });
  }

  const osmRef = text(source, 'osmRef', errors);
  if (osmRef && !OSM_REF_PATTERN.test(osmRef)) {
    errors.push({ field: 'osmRef', message: 'Field "osmRef" must look like "node:123", "way:123" or "relation:123"' });
  }

  if (errors.length > 0) throw ApiError.validation(errors);

  return {
    name: name as string,
    description,
    address: address as string,
    city: city as string,
    country: (countryCode as string).toUpperCase(),
    location: location as GeoLocation,
    externalId,
    externalSource,
    osmRef,
  };
}

function queryValue(query: Source, field: string): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw ApiError.badRequest(`Query parameter "${field}" must be given once`);
  if (!value.trim()) throw ApiError.badRequest(`Query parameter "${field}" must not be empty`);
  return value.trim();
}

function positiveInteger(query: Source, field: string, fallback: number, max?: number): number {
  const raw = queryValue(query, field);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < 1 || (max !== undefined && value > max)) {
    const range = max === undefined ? 'a positive integer' : `an integer between 1 and ${max}`;
    throw ApiError.badRequest(`Query parameter "${field}" must be ${range}`);
  }
  return value;
}

function queryNumber(query: Source, field: string): number | undefined {
  const raw = queryValue(query, field);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw ApiError.badRequest(`Query parameter "${field}" must be a number`);
  return value;
}

export function parseListVenuesQuery(rawQuery: unknown): ListVenuesQuery {
  const query = asSource(rawQuery);
  const page = positiveInteger(query, 'page', PAGINATION.defaultPage);
  const limit = positiveInteger(query, 'limit', PAGINATION.defaultLimit, PAGINATION.maxLimit);

  const filters: VenueSearchFilters = {};

  const lat = queryNumber(query, 'lat');
  const lng = queryNumber(query, 'lng');
  const radiusKm = queryNumber(query, 'radius_km');
  const geoGiven = [lat, lng, radiusKm].filter((value) => value !== undefined).length;
  if (geoGiven > 0) {
    if (geoGiven < 3) {
      throw ApiError.badRequest('Query parameters "lat", "lng" and "radius_km" must be given together');
    }
    filters.near = {
      lat: coordinate(lat, 'lat', 90),
      lng: coordinate(lng, 'lng', 180),
      radiusKm: radiusKm as number,
    };
    if (filters.near.radiusKm <= 0 || filters.near.radiusKm > MAX_RADIUS_KM) {
      throw ApiError.badRequest(`Query parameter "radius_km" must be greater than 0 and at most ${MAX_RADIUS_KM}`);
    }
  }

  const countryFilter = queryValue(query, 'country');
  if (countryFilter !== undefined) filters.country = country(countryFilter, 'country');
  const city = queryValue(query, 'city');
  if (city !== undefined) filters.city = city;
  const name = queryValue(query, 'name');
  if (name !== undefined) filters.name = name;

  return { page, limit, filters };
}
