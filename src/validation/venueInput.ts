import type { GeoLocation } from '../entities/Venue';
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

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });

/** True for an assigned ISO 3166-1 alpha-2 code (case-insensitive). */
export function isIsoCountryCode(value: string): boolean {
  if (!/^[A-Za-z]{2}$/.test(value)) return false;
  const code = value.toUpperCase();
  // ZZ is the CLDR "Unknown Region"; unassigned codes resolve to themselves.
  return code !== 'ZZ' && regionNames.of(code) !== code;
}

type Source = Record<string, unknown>;

function asSource(value: unknown): Source {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Source) : {};
}

function text(source: Source, field: string, required: true): string;
function text(source: Source, field: string, required: false): string | null;
function text(source: Source, field: string, required: boolean): string | null {
  const value = source[field];
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    if (required) throw ApiError.badRequest(`Field "${field}" is required`);
    return null;
  }
  if (typeof value !== 'string') throw ApiError.badRequest(`Field "${field}" must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw ApiError.badRequest(`Field "${field}" must be at most ${MAX_TEXT_LENGTH} characters`);
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

export function parseCreateVenue(body: unknown): CreateVenueCommand {
  const source = asSource(body);

  const name = text(source, 'name', true);
  const description = text(source, 'description', false);
  const address = text(source, 'address', true);
  const city = text(source, 'city', true);
  const countryCode = country(text(source, 'country', true), 'country');

  if (source.location === undefined || source.location === null) {
    throw ApiError.badRequest('Field "location" is required');
  }
  if (typeof source.location !== 'object' || Array.isArray(source.location)) {
    throw ApiError.badRequest('Field "location" must be an object with "lat" and "lng"');
  }
  const rawLocation = asSource(source.location);
  const location: GeoLocation = {
    lat: coordinate(rawLocation.lat, 'location.lat', 90),
    lng: coordinate(rawLocation.lng, 'location.lng', 180),
  };

  const externalId = text(source, 'externalId', false);
  const externalSource = text(source, 'externalSource', false);
  if (externalId && !externalSource) {
    throw ApiError.badRequest('Field "externalSource" is required when "externalId" is present');
  }

  const osmRef = text(source, 'osmRef', false);
  if (osmRef && !OSM_REF_PATTERN.test(osmRef)) {
    throw ApiError.badRequest('Field "osmRef" must look like "node:123", "way:123" or "relation:123"');
  }

  return { name, description, address, city, country: countryCode, location, externalId, externalSource, osmRef };
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
