/**
 * Seat-map payload contract. Human-readable specification: docs/map-format.md.
 * The OpenAPI schemas, the validators and the shared fixtures
 * (tests/fixtures/maps) are all derived from the constants declared here.
 */

/** Normalized position: 0..1 on both axes, origin top-left, x to the right, y downwards. */
export interface Point {
  x: number;
  y: number;
}

export interface Stage {
  /** Optional caption shown on the stage, e.g. "Main stage". */
  label?: string | null;
  /** Polygon ring, not closed (the last point is not a copy of the first). */
  outline: Point[];
}

export interface Zone {
  id: string;
  name: string;
  outline: Point[];
}

export interface Seat {
  id: string;
  /** Seat label as printed on the ticket, e.g. "12". */
  label: string;
  /** Row label, e.g. "A"; null for seats that are not part of a row. */
  row: string | null;
  /** Id of the zone the seat belongs to. */
  zone: string | null;
  /** Centre of the seat. */
  position: Point;
  /** Clockwise rotation in degrees, [0, 360). Defaults to 0. */
  rotation?: number;
}

/** Body of `POST /venues/{id}/map`. */
export interface MapPayload {
  stage: Stage | null;
  zones: Zone[];
  seats: Seat[];
}

/** Stored, immutable snapshot returned by the map endpoints. */
export interface MapVersionDocument extends MapPayload {
  venueId: string;
  version: number;
  createdAt: string;
}

/** 422 error codes, in the order the validator reports them. */
export const MAP_ERROR_CODES = [
  'NO_STAGE',
  'UNNAMED_ZONE',
  'EMPTY_ZONE',
  'SEAT_WITHOUT_ZONE',
  'DUPLICATE_LABEL',
  'OVERLAP',
] as const;

export type MapErrorCode = (typeof MAP_ERROR_CODES)[number];

export interface MapValidationIssue {
  code: MapErrorCode;
  message: string;
  seatIds?: string[];
  zoneIds?: string[];
}

/** Body of a 422 answer to `POST /venues/{id}/map`. */
export interface MapValidationErrorBody {
  error: string;
  errors: MapValidationIssue[];
}

export const MAP_LIMITS = {
  /** Decimals kept for every coordinate. */
  coordinateDecimals: 4,
  coordinateMin: 0,
  coordinateMax: 1,
  /** Two seat centres closer than this (Euclidean, normalized units) overlap. */
  seatMinDistance: 0.005,
  outlineMinPoints: 3,
  outlineMaxPoints: 200,
  maxZones: 200,
  maxSeats: 50000,
  idPattern: /^[A-Za-z0-9_-]{1,64}$/,
  maxLabelLength: 32,
  maxNameLength: 100,
} as const;

/** Maximum JSON body accepted by `POST /venues/{id}/map` (enough for MAP_LIMITS.maxSeats seats). */
export const MAP_BODY_LIMIT = '10mb';

/** Rounds a coordinate to the contract precision (half away from zero). */
export function roundCoordinate(value: number): number {
  const factor = 10 ** MAP_LIMITS.coordinateDecimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}
