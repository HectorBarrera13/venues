import fs from 'node:fs';
import path from 'node:path';
import { MAP_ERROR_CODES, MAP_LIMITS } from '../src/maps/mapFormat';
import { checkMapRules } from './helpers/mapRulesOracle';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/maps');

interface ManifestEntry {
  description: string;
  expectedErrors: { code: string; seatIds?: string[]; zoneIds?: string[] }[];
}

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8')) as {
  contract: string;
  fixtures: Record<string, ManifestEntry>;
};
const fixtureNames = Object.keys(manifest.fixtures);

function load(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

/** Structural part of docs/map-format.md: everything that would be a 400, not a 422. */
function structuralProblems(map: any): string[] {
  const problems: string[] = [];
  const isPoint = (p: any) => p && Object.keys(p).sort().join() === 'x,y' && [p.x, p.y].every((value) =>
    typeof value === 'number' && value >= MAP_LIMITS.coordinateMin && value <= MAP_LIMITS.coordinateMax
    && Number(value.toFixed(MAP_LIMITS.coordinateDecimals)) === value);
  const isOutline = (ring: any) => Array.isArray(ring) && ring.length >= MAP_LIMITS.outlineMinPoints
    && ring.length <= MAP_LIMITS.outlineMaxPoints && ring.every(isPoint);
  const isNullableText = (value: any, max: number) => value === null || (typeof value === 'string' && value.length <= max);

  if (Object.keys(map).sort().join() !== 'seats,stage,zones') problems.push('top-level keys');
  if (map.stage !== null && (!isOutline(map.stage.outline) || !isNullableText(map.stage.label ?? null, MAP_LIMITS.maxNameLength))) {
    problems.push('stage');
  }
  if (!Array.isArray(map.zones) || map.zones.length > MAP_LIMITS.maxZones) problems.push('zones');
  if (!Array.isArray(map.seats) || map.seats.length > MAP_LIMITS.maxSeats) problems.push('seats');

  for (const zone of map.zones) {
    if (Object.keys(zone).sort().join() !== 'id,name,outline' || !MAP_LIMITS.idPattern.test(zone.id)
      || typeof zone.name !== 'string' || zone.name.length > MAP_LIMITS.maxNameLength || !isOutline(zone.outline)) {
      problems.push(`zone ${zone.id}`);
    }
  }
  for (const seat of map.seats) {
    const keys = Object.keys(seat).filter((k) => k !== 'rotation').sort().join();
    const rotationOk = seat.rotation === undefined
      || (typeof seat.rotation === 'number' && seat.rotation >= 0 && seat.rotation < 360);
    if (keys !== 'id,label,position,row,zone' || !MAP_LIMITS.idPattern.test(seat.id)
      || typeof seat.label !== 'string' || !seat.label.trim() || seat.label.length > MAP_LIMITS.maxLabelLength
      || !isNullableText(seat.row, MAP_LIMITS.maxLabelLength) || !(seat.zone === null || typeof seat.zone === 'string')
      || !isPoint(seat.position) || !rotationOk) {
      problems.push(`seat ${seat.id}`);
    }
  }

  const ids = [...map.zones, ...map.seats].map((element: { id: string }) => element.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate ids');
  return problems;
}

describe('shared map fixtures (tests/fixtures/maps)', () => {
  it('lists every fixture file in the manifest and nothing else', () => {
    const files = fs.readdirSync(FIXTURES_DIR).filter((file) => file !== 'manifest.json').sort();
    expect(fixtureNames.slice().sort()).toEqual(files);
    expect(manifest.contract).toBe('docs/map-format.md');
  });

  it('has a valid fixture and at least one fixture per error code', () => {
    expect(manifest.fixtures['valid-v1.json'].expectedErrors).toEqual([]);
    const covered = new Set(fixtureNames.flatMap((name) => manifest.fixtures[name].expectedErrors.map((e) => e.code)));
    expect([...covered].sort()).toEqual([...MAP_ERROR_CODES].sort());
  });

  it('includes a multi-error fixture breaking at least three rules', () => {
    const codes = new Set(manifest.fixtures['multi-error.json'].expectedErrors.map((error) => error.code));
    expect(codes.size).toBeGreaterThanOrEqual(3);
  });

  it('describes valid-v1 with stage, two or more zones, row blocks, loose seats and rotation', () => {
    const map = load('valid-v1.json');
    expect(map.stage).not.toBeNull();
    expect(map.zones.length).toBeGreaterThanOrEqual(2);
    expect(map.seats.some((seat: { row: string | null }) => seat.row === null)).toBe(true);
    expect(new Set(map.seats.map((seat: { row: string | null }) => seat.row)).size).toBeGreaterThan(2);
    expect(map.seats.some((seat: { rotation?: number }) => seat.rotation)).toBe(true);
  });

  describe.each(fixtureNames)('%s', (name) => {
    it('is well-formed according to the map format (no 400)', () => {
      expect(structuralProblems(load(name))).toEqual([]);
    });

    it('triggers exactly the errors listed in the manifest', () => {
      expect(checkMapRules(load(name))).toEqual(manifest.fixtures[name].expectedErrors);
    });
  });
});
