import { randomUUID } from 'node:crypto';

/** WGS84 position as exposed by the API. */
export interface GeoLocation {
  lat: number;
  lng: number;
}

/** GeoJSON Point as stored in the venue store; coordinates are [lng, lat]. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface VenueProps {
  id?: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  country: string;
  location: GeoLocation;
  externalId?: string | null;
  externalSource?: string | null;
  osmRef?: string | null;
  latestMapVersion?: number;
  ownerId: string;
  createdAt?: string | Date;
}

export interface VenueJSON {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  country: string;
  location: GeoLocation;
  externalId: string | null;
  externalSource: string | null;
  osmRef: string | null;
  latestMapVersion: number;
  ownerId: string;
  createdAt: string;
}

/** One invalid input field, named as the client sends it (`lat`/`lng` for the location). */
export interface FieldError {
  field: string;
  message: string;
}

/** Raised when venue data breaks a domain rule; carries every violated field. */
export class VenueValidationError extends Error {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super(errors.map((error) => error.message).join('; '));
    this.name = 'VenueValidationError';
    this.errors = errors;
  }
}

export const VENUE_REQUIRED_FIELDS = ['name', 'address', 'city', 'country'] as const;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });

/** True for an assigned ISO 3166-1 alpha-2 code (case-insensitive). */
export function isIsoCountryCode(value: string): boolean {
  if (!/^[A-Za-z]{2}$/.test(value)) return false;
  const code = value.toUpperCase();
  // ZZ is the CLDR "Unknown Region"; unassigned codes resolve to themselves.
  return code !== 'ZZ' && regionNames.of(code) !== code;
}

function coordinateError(value: unknown, field: 'lat' | 'lng', limit: number): FieldError | null {
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit) return null;
  return { field, message: `Field "${field}" must be a number between -${limit} and ${limit}` };
}

/** Domain rules of a venue: required text present, real WGS84 coordinates, ISO alpha-2 country. */
export function validateVenueProps(props: Partial<VenueProps>): FieldError[] {
  const errors: FieldError[] = [];
  for (const field of VENUE_REQUIRED_FIELDS) {
    const value = props[field];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push({ field, message: `Field "${field}" is required` });
    }
  }
  if (typeof props.country === 'string' && props.country.trim() && !isIsoCountryCode(props.country.trim())) {
    errors.push({ field: 'country', message: 'Field "country" must be an ISO 3166-1 alpha-2 country code' });
  }
  if (!props.location || typeof props.location !== 'object') {
    errors.push({ field: 'location', message: 'Field "location" is required' });
  } else {
    const lat = coordinateError(props.location.lat, 'lat', 90);
    const lng = coordinateError(props.location.lng, 'lng', 180);
    if (lat) errors.push(lat);
    if (lng) errors.push(lng);
  }
  return errors;
}

/**
 * Canonical form of a venue name used for search and duplicate detection:
 * accents removed, lower case, punctuation turned into spaces, whitespace collapsed.
 */
export function normalizeVenueName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function toGeoPoint({ lat, lng }: GeoLocation): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function fromGeoPoint(point: { coordinates: number[] }): GeoLocation {
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

export default class Venue {
  readonly id: string;
  readonly name: string;
  readonly nameNormalized: string;
  readonly description: string | null;
  readonly address: string;
  readonly city: string;
  readonly country: string;
  readonly location: GeoLocation;
  readonly externalId: string | null;
  readonly externalSource: string | null;
  readonly osmRef: string | null;
  readonly latestMapVersion: number;
  readonly ownerId: string;
  readonly createdAt: string;

  constructor(props: VenueProps) {
    const errors = validateVenueProps(props);
    if (errors.length > 0) throw new VenueValidationError(errors);

    this.id = props.id || randomUUID();
    this.name = props.name;
    this.nameNormalized = normalizeVenueName(props.name);
    this.description = props.description ?? null;
    this.address = props.address;
    this.city = props.city;
    this.country = props.country.trim().toUpperCase();
    this.location = { lat: props.location.lat, lng: props.location.lng };
    this.externalId = props.externalId ?? null;
    this.externalSource = props.externalSource ?? null;
    this.osmRef = props.osmRef ?? null;
    this.latestMapVersion = props.latestMapVersion ?? 0;
    this.ownerId = props.ownerId;
    this.createdAt = props.createdAt instanceof Date
      ? props.createdAt.toISOString()
      : props.createdAt || new Date().toISOString();
  }

  belongsTo(userId: string | null | undefined): boolean {
    return Boolean(userId && this.ownerId === userId);
  }

  toGeoPoint(): GeoPoint {
    return toGeoPoint(this.location);
  }

  toJSON(): VenueJSON {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      address: this.address,
      city: this.city,
      country: this.country,
      location: { ...this.location },
      externalId: this.externalId,
      externalSource: this.externalSource,
      osmRef: this.osmRef,
      latestMapVersion: this.latestMapVersion,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
    };
  }
}
