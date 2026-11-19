/**
 * VEN-201 — structural validator for the `POST /venues/{id}/map` body.
 *
 * Everything in docs/map-format.md that is a malformed payload (wrong types, missing
 * arrays, coordinates out of range, bad or duplicate ids, limits exceeded,
 * self-intersecting outlines) is rejected here with `400`, before any business rule
 * runs. Well-formed payloads come out normalized: coordinates rounded to the contract
 * precision and `rotation` defaulted to `0`. The backend rounds, never clamps (section 2).
 */
import ApiError from '../../errors/ApiError';
import {
  MAP_LIMITS,
  roundCoordinate,
  type MapPayload,
  type Point,
  type Seat,
  type Stage,
  type Zone,
} from '../../maps/mapFormat';
import { isSimplePolygon } from './geometry';

const COORDINATE_EXPECTATION = `must be a number between ${MAP_LIMITS.coordinateMin} and ${MAP_LIMITS.coordinateMax}`;

function badField(field: string, expectation: string): never {
  throw ApiError.badRequest(`Field "${field}" ${expectation}`);
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    badField(field, 'must be an object');
  }
  return value as Record<string, unknown>;
}

/** Keys must be exactly `required` plus any of `optional` (top level and every element). */
function checkKeys(obj: Record<string, unknown>, required: string[], optional: string[], field: string): void {
  const allowed = [...required, ...optional];
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) badField(`${field}.${key}`, 'is not part of the map contract');
  }
  for (const key of required) {
    if (!(key in obj)) badField(`${field}.${key}`, 'is required by the map contract');
  }
}

function parseId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !MAP_LIMITS.idPattern.test(value)) {
    badField(field, `must match ${MAP_LIMITS.idPattern}`);
  }
  return value;
}

function parseText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') badField(field, 'must be a string');
  if (value.length > max) badField(field, `must be at most ${max} characters`);
  return value;
}

function parseNullableText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  return parseText(value, field, max);
}

function parseCoordinate(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) badField(field, COORDINATE_EXPECTATION);
  const rounded = roundCoordinate(value);
  if (rounded < MAP_LIMITS.coordinateMin || rounded > MAP_LIMITS.coordinateMax) {
    badField(field, COORDINATE_EXPECTATION);
  }
  return rounded;
}

function parsePoint(value: unknown, field: string): Point {
  const point = asObject(value, field);
  checkKeys(point, ['x', 'y'], [], field);
  return { x: parseCoordinate(point.x, `${field}.x`), y: parseCoordinate(point.y, `${field}.y`) };
}

function parseOutline(value: unknown, field: string): Point[] {
  if (!Array.isArray(value)) badField(field, 'must be an array of points');
  if (value.length < MAP_LIMITS.outlineMinPoints || value.length > MAP_LIMITS.outlineMaxPoints) {
    badField(field, `must be a ring of ${MAP_LIMITS.outlineMinPoints} to ${MAP_LIMITS.outlineMaxPoints} points`);
  }
  const ring = value.map((point, index) => parsePoint(point, `${field}[${index}]`));
  if (!isSimplePolygon(ring)) badField(field, 'must be a simple polygon: its outline crosses itself');
  return ring;
}

function parseRotation(value: unknown, field: string): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 360) {
    badField(field, 'must be a number of degrees between 0 and 360');
  }
  return value;
}

function parseStage(value: unknown): Stage | null {
  // `stage` missing or null is a well-formed payload; the missing stage is rule R1 (422).
  if (value === null || value === undefined) return null;
  const stage = asObject(value, 'stage');
  checkKeys(stage, ['outline'], ['label'], 'stage');
  return {
    label: parseNullableText(stage.label, 'stage.label', MAP_LIMITS.maxNameLength),
    outline: parseOutline(stage.outline, 'stage.outline'),
  };
}

function parseZones(value: unknown): Zone[] {
  if (!Array.isArray(value)) badField('zones', 'must be an array');
  if (value.length > MAP_LIMITS.maxZones) badField('zones', `must not exceed ${MAP_LIMITS.maxZones} zones`);
  return value.map((raw, index) => {
    const field = `zones[${index}]`;
    const zone = asObject(raw, field);
    checkKeys(zone, ['id', 'name', 'outline'], [], field);
    return {
      id: parseId(zone.id, `${field}.id`),
      name: parseText(zone.name, `${field}.name`, MAP_LIMITS.maxNameLength),
      outline: parseOutline(zone.outline, `${field}.outline`),
    };
  });
}

function parseSeats(value: unknown): Seat[] {
  if (!Array.isArray(value)) badField('seats', 'must be an array');
  if (value.length > MAP_LIMITS.maxSeats) badField('seats', `must not exceed ${MAP_LIMITS.maxSeats} seats`);
  return value.map((raw, index) => {
    const field = `seats[${index}]`;
    const seat = asObject(raw, field);
    checkKeys(seat, ['id', 'label', 'row', 'zone', 'position'], ['rotation'], field);
    const label = parseText(seat.label, `${field}.label`, MAP_LIMITS.maxLabelLength);
    if (!label.trim()) badField(`${field}.label`, 'must not be blank');
    const row = parseNullableText(seat.row, `${field}.row`, MAP_LIMITS.maxLabelLength);
    if (row !== null && !row.trim()) badField(`${field}.row`, 'must not be blank; use null for seats outside a row');
    // An unknown (ghost) zone id is structurally fine: rule R4 reports it as SEAT_WITHOUT_ZONE.
    const zone = seat.zone === null ? null : parseId(seat.zone, `${field}.zone`);
    return {
      id: parseId(seat.id, `${field}.id`),
      label,
      row,
      zone,
      position: parsePoint(seat.position, `${field}.position`),
      rotation: parseRotation(seat.rotation, `${field}.rotation`),
    };
  });
}

/** Seat and zone ids are unique across the whole map (docs/map-format.md section 3.2). */
function assertUniqueIds(zones: Zone[], seats: Seat[]): void {
  const seen = new Map<string, string>();
  for (const [field, id] of [
    ...zones.map((zone, index) => [`zones[${index}].id`, zone.id] as const),
    ...seats.map((seat, index) => [`seats[${index}].id`, seat.id] as const),
  ]) {
    const previous = seen.get(id);
    if (previous) badField(field, `duplicates the id "${id}" already used by ${previous}`);
    seen.set(id, field);
  }
}

/**
 * Validates an unknown request body against the contract and returns the normalized
 * payload to store. Throws `ApiError` 400 describing the first offending field.
 */
export function parseMapPayload(body: unknown): MapPayload {
  const payload = asObject(body, 'body');
  checkKeys(payload, ['zones', 'seats'], ['stage'], 'body');
  const zones = parseZones(payload.zones);
  const seats = parseSeats(payload.seats);
  assertUniqueIds(zones, seats);
  return { stage: parseStage(payload.stage), zones, seats };
}
