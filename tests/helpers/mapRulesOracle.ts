/**
 * Minimal reference implementation of the business rules in docs/map-format.md
 * (section 5). Test-only: it proves the shared fixtures trigger exactly the codes
 * listed in tests/fixtures/maps/manifest.json. The production validator (VEN-202)
 * must agree with the same manifest.
 */
import { MAP_ERROR_CODES, MAP_LIMITS, type MapPayload, type Point } from '../../src/maps/mapFormat';

export interface OracleIssue {
  code: string;
  seatIds?: string[];
  zoneIds?: string[];
}

const EPSILON = 1e-9;

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  return Math.abs(cross(a, b, p)) < EPSILON
    && p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
    && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON;
}

function edges(ring: Point[]): [Point, Point][] {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length]]);
}

function onBoundary(p: Point, ring: Point[]): boolean {
  return edges(ring).some(([a, b]) => onSegment(p, a, b));
}

function strictlyInside(p: Point, ring: Point[]): boolean {
  if (onBoundary(p, ring)) return false;
  let inside = false;
  for (const [a, b] of edges(ring)) {
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function insideOrOnBoundary(p: Point, ring: Point[]): boolean {
  return onBoundary(p, ring) || strictlyInside(p, ring);
}

function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < -EPSILON && d3 * d4 < -EPSILON;
}

/** Interiors intersect; shared edges or vertices do not count. */
function outlinesOverlap(first: Point[], second: Point[]): boolean {
  const probes = (ring: Point[]) => [
    ...ring,
    ...edges(ring).map(([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })),
  ];
  return edges(first).some(([a, b]) => edges(second).some(([c, d]) => properlyCross(a, b, c, d)))
    || probes(first).some((p) => strictlyInside(p, second))
    || probes(second).some((p) => strictlyInside(p, first));
}

const key = (value: string | null) => (value ?? '').trim().toLowerCase();

export function checkMapRules(map: MapPayload): OracleIssue[] {
  const issues: OracleIssue[] = [];
  const zonesById = new Map(map.zones.map((zone) => [zone.id, zone]));

  if (!map.stage) issues.push({ code: 'NO_STAGE' });

  const unnamed = map.zones.filter((zone) => !zone.name.trim()).map((zone) => zone.id);
  if (unnamed.length) issues.push({ code: 'UNNAMED_ZONE', zoneIds: unnamed });

  const empty = map.zones.filter((zone) => !map.seats.some((seat) => seat.zone === zone.id)).map((zone) => zone.id);
  if (empty.length) issues.push({ code: 'EMPTY_ZONE', zoneIds: empty });

  const homeless = map.seats.filter((seat) => {
    const zone = seat.zone === null ? undefined : zonesById.get(seat.zone);
    return !zone || !insideOrOnBoundary(seat.position, zone.outline);
  });
  if (homeless.length) issues.push({ code: 'SEAT_WITHOUT_ZONE', seatIds: homeless.map((seat) => seat.id) });

  const groups = new Map<string, { zone: string; seatIds: string[] }>();
  for (const seat of map.seats) {
    if (seat.zone === null || !zonesById.has(seat.zone)) continue;
    const groupKey = JSON.stringify([seat.zone, key(seat.row), key(seat.label)]);
    const group = groups.get(groupKey) ?? { zone: seat.zone, seatIds: [] };
    group.seatIds.push(seat.id);
    groups.set(groupKey, group);
  }
  for (const group of groups.values()) {
    if (group.seatIds.length > 1) {
      issues.push({ code: 'DUPLICATE_LABEL', seatIds: group.seatIds, zoneIds: [group.zone] });
    }
  }

  map.seats.forEach((first, index) => {
    for (const second of map.seats.slice(index + 1)) {
      const distance = Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y);
      if (distance < MAP_LIMITS.seatMinDistance) issues.push({ code: 'OVERLAP', seatIds: [first.id, second.id] });
    }
  });
  map.zones.forEach((first, index) => {
    for (const second of map.zones.slice(index + 1)) {
      if (outlinesOverlap(first.outline, second.outline)) {
        issues.push({ code: 'OVERLAP', zoneIds: [first.id, second.id] });
      }
    }
  });

  const order = (code: string) => MAP_ERROR_CODES.indexOf(code as (typeof MAP_ERROR_CODES)[number]);
  return issues.sort((a, b) => order(a.code) - order(b.code));
}
