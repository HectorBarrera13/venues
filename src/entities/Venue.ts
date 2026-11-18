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

const EARTH_RADIUS_KM = 6371.0088;

/** Rounds kilometres to two decimal places (used by geospatial search results). */
export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm * 100) / 100 || 0;
}

/** Great-circle distance between two WGS84 points in kilometres. */
export function haversineDistanceKm(from: GeoLocation, to: GeoLocation): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
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
