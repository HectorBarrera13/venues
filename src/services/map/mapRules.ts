/**
 * VEN-202 — business-rule validator for a structurally sound seat map.
 *
 * Implements rules R1–R6 of docs/map-format.md and returns every violation in one
 * pass (never fail-fast): `tests/helpers/mapRulesOracle.ts` is the reference and
 * `tests/fixtures/maps/manifest.json` is the golden answer for the shared fixtures.
 * The list is ordered by the error-code catalogue, then by payload order.
 */
import { MAP_ERROR_CODES, MAP_LIMITS, type MapPayload, type MapValidationIssue } from '../../maps/mapFormat';
import { insideOrOnBoundary, outlinesOverlap, boundingBox, boxesOverlap } from './geometry';

const key = (value: string | null): string => (value ?? '').trim().toLowerCase();

/** One error per code that names elements; `message` is display text only (contract 4.3). */
function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * R6a with a spatial hash: seats are bucketed into cells of `seatMinDistance`, so an
 * N-seat map runs in O(N) per neighbourhood instead of O(N²) — the 5,000-seat
 * benchmark in tests/map/validation.test.ts relies on it. Pairs come out in payload
 * order ([earlier, later]), exactly like the reference oracle.
 */
function overlappingSeatPairs(map: MapPayload): [string, string][] {
  const cell = MAP_LIMITS.seatMinDistance;
  const buckets = new Map<string, number[]>();
  const pairs: [number, number][] = [];
  const limit = MAP_LIMITS.seatMinDistance;

  map.seats.forEach((seat, index) => {
    const cx = Math.floor(seat.position.x / cell);
    const cy = Math.floor(seat.position.y / cell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const neighbours = buckets.get(`${cx + dx},${cy + dy}`);
        if (!neighbours) continue;
        for (const earlier of neighbours) {
          const other = map.seats[earlier];
          const distance = Math.hypot(seat.position.x - other.position.x, seat.position.y - other.position.y);
          if (distance < limit) pairs.push([earlier, index]);
        }
      }
    }
    const bucketKey = `${cx},${cy}`;
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(index);
    buckets.set(bucketKey, bucket);
  });

  // Payload order, like the reference oracle: by first seat, then by second seat.
  return pairs
    .sort(([firstA, secondA], [firstB, secondB]) => firstA - firstB || secondA - secondB)
    .map(([first, second]) => [map.seats[first].id, map.seats[second].id] as [string, string]);
}

function overlappingZonePairs(map: MapPayload): [string, string][] {
  const boxes = map.zones.map((zone) => boundingBox(zone.outline));
  const pairs: [string, string][] = [];
  for (let i = 0; i < map.zones.length; i += 1) {
    for (let j = i + 1; j < map.zones.length; j += 1) {
      if (!boxesOverlap(boxes[i], boxes[j])) continue;
      if (outlinesOverlap(map.zones[i].outline, map.zones[j].outline)) {
        pairs.push([map.zones[i].id, map.zones[j].id]);
      }
    }
  }
  return pairs;
}

export function checkMapRules(map: MapPayload): MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];
  const zonesById = new Map(map.zones.map((zone) => [zone.id, zone]));

  // R1 — the map has a stage.
  if (!map.stage) {
    issues.push({ code: 'NO_STAGE', message: 'The map has no stage' });
  }

  // R2 — every zone has a non-blank name.
  const unnamed = map.zones.filter((zone) => !zone.name.trim()).map((zone) => zone.id);
  if (unnamed.length) {
    issues.push({
      code: 'UNNAMED_ZONE',
      message: `${plural(unnamed.length, 'zone')} ${unnamed.length === 1 ? 'has' : 'have'} no name`,
      zoneIds: unnamed,
    });
  }

  // R3 — every zone contains at least one seat (membership is by `seat.zone`, not geometry).
  const empty = map.zones.filter((zone) => !map.seats.some((seat) => seat.zone === zone.id)).map((zone) => zone.id);
  if (empty.length) {
    issues.push({
      code: 'EMPTY_ZONE',
      message: `${plural(empty.length, 'zone')} ${empty.length === 1 ? 'has' : 'have'} no seats`,
      zoneIds: empty,
    });
  }

  // R4 — every seat references an existing zone and lies inside its outline (boundary counts).
  const homeless = map.seats
    .filter((seat) => {
      const zone = seat.zone === null ? undefined : zonesById.get(seat.zone);
      return !zone || !insideOrOnBoundary(seat.position, zone.outline);
    })
    .map((seat) => seat.id);
  if (homeless.length) {
    issues.push({
      code: 'SEAT_WITHOUT_ZONE',
      message: `${plural(homeless.length, 'seat')} ${homeless.length === 1 ? 'is' : 'are'} not inside a zone`,
      seatIds: homeless,
    });
  }

  // R5 — within a zone, (row, label) is unique. Seats whose zone does not exist are skipped.
  const groups = new Map<string, { zone: string; seatIds: string[]; display: string }>();
  for (const seat of map.seats) {
    if (seat.zone === null || !zonesById.has(seat.zone)) continue;
    const groupKey = JSON.stringify([seat.zone, key(seat.row), key(seat.label)]);
    const group = groups.get(groupKey) ?? {
      zone: seat.zone,
      seatIds: [],
      display: seat.row ? `${seat.row.trim()}-${seat.label.trim()}` : seat.label.trim(),
    };
    group.seatIds.push(seat.id);
    groups.set(groupKey, group);
  }
  for (const group of groups.values()) {
    if (group.seatIds.length > 1) {
      issues.push({
        code: 'DUPLICATE_LABEL',
        message: `Seat ${group.display} appears ${group.seatIds.length} times in zone ${group.zone}`,
        seatIds: group.seatIds,
        zoneIds: [group.zone],
      });
    }
  }

  // R6a/R6b — overlaps, one error per offending pair.
  for (const [first, second] of overlappingSeatPairs(map)) {
    issues.push({ code: 'OVERLAP', message: `Seats ${first} and ${second} overlap`, seatIds: [first, second] });
  }
  for (const [first, second] of overlappingZonePairs(map)) {
    issues.push({ code: 'OVERLAP', message: `Zones ${first} and ${second} overlap`, zoneIds: [first, second] });
  }

  const order = (code: MapValidationIssue['code']) => MAP_ERROR_CODES.indexOf(code);
  return issues.sort((a, b) => order(a.code) - order(b.code));
}
