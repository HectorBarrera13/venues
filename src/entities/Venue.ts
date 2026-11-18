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
    this.id = props.id || randomUUID();
    this.name = props.name;
    this.nameNormalized = normalizeVenueName(props.name);
    this.description = props.description ?? null;
    this.address = props.address;
    this.city = props.city;
    this.country = props.country.toUpperCase();
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
