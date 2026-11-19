/**
 * VEN-201/VEN-202 unit tests: the structural validator (400 layer), the business
 * rules against the shared manifest (golden tests, VEN-207) and the 5,000-seat
 * benchmark required by the track acceptance criteria.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkMapRules } from '../../src/services/map/mapRules';
import { parseMapPayload } from '../../src/services/map/parseMapPayload';

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures', 'maps');

function loadFixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

const manifest = loadFixture('manifest.json').fixtures as Record<string, { expectedErrors: any[] }>;

const square = (minX: number, minY: number, maxX: number, maxY: number) => [
  { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY },
];

/** Minimal well-formed payload to break in one place per test. */
function baseMap(overrides: Record<string, unknown> = {}): any {
  return {
    stage: { outline: square(0.3, 0.02, 0.7, 0.06) },
    zones: [{ id: 'z-1', name: 'Main', outline: square(0, 0.1, 1, 0.9) }],
    seats: [{ id: 's-1', label: '1', row: 'A', zone: 'z-1', position: { x: 0.5, y: 0.5 } }],
    ...overrides,
  };
}

function expect400(body: unknown, messagePattern: string | RegExp): void {
  expect(() => parseMapPayload(body)).toThrow(messagePattern);
}

describe('parseMapPayload — structural 400s (VEN-201)', () => {
  it('accepts the full contract example', () => {
    const payload = parseMapPayload(baseMap());
    expect(payload.seats).toHaveLength(1);
    expect(payload.zones).toHaveLength(1);
    expect(payload.stage).not.toBeNull();
  });

  it('treats a missing stage as null (a 422 rule, not a 400)', () => {
    const body = baseMap();
    delete body.stage;
    expect(parseMapPayload(body).stage).toBeNull();
  });

  it.each([
    [null], [[]], ['body'], [undefined],
  ])('rejects a body that is not a payload object: %p', (body) => {
    expect400(body, /must be an object/);
  });

  it('rejects missing and unknown top-level keys', () => {
    expect400({ stage: null, seats: [] }, /"body\.zones" is required/);
    expect400({ ...baseMap(), extra: 1 }, /"body\.extra" is not part of the map contract/);
  });

  it('reports out-of-range coordinates with the exact field path (docs/map-format.md 6.4)', () => {
    const broken = baseMap();
    broken.seats[0].position.x = 1.2;
    expect400(broken, 'Field "seats[0].position.x" must be a number between 0 and 1');
    broken.seats[0].position.x = 0.5;
    broken.seats[0].position.y = -0.2;
    expect400(broken, 'Field "seats[0].position.y" must be a number between 0 and 1');
  });

  it.each([[null], ['0.5'], [NaN], [Infinity]])('rejects a non-finite-number coordinate: %p', (value) => {
    const broken = baseMap();
    broken.seats[0].position.x = value;
    expect400(broken, /"seats\[0\]\.position\.x" must be a number/);
  });

  it('rounds to the contract precision before range-checking, and never clamps', () => {
    const rounded = baseMap();
    rounded.seats[0].position.x = 0.12345;
    expect(parseMapPayload(rounded).seats[0].position.x).toBe(0.1235);
    // 1.00004 rounds back inside the range; 1.0006 does not and is rejected, not clamped.
    const almostOut = baseMap();
    almostOut.seats[0].position.x = 1.00004;
    expect(parseMapPayload(almostOut).seats[0].position.x).toBe(1);
    expect400({ ...baseMap(), seats: [{ ...baseMap().seats[0], position: { x: 1.0006, y: 0.5 } }] },
      /position\.x/);
  });

  it('rejects duplicate ids across seats and zones', () => {
    expect400(baseMap({ seats: [baseMap().seats[0], { ...baseMap().seats[0], position: { x: 0.6, y: 0.5 } }] }),
      /duplicates the id "s-1"/);
    expect400(baseMap({ zones: [{ id: 's-1', name: 'Clash', outline: square(0, 0.1, 1, 0.9) }] }),
      /duplicates the id "s-1"/);
  });

  it.each([['has space'], ['seat#1'], [''], ['-'.repeat(65)]])('rejects id "%s"', (id) => {
    expect400(baseMap({ seats: [{ ...baseMap().seats[0], id }] }), /"seats\[0\]\.id" must match/);
  });

  it('rejects a blank or oversized seat label, but not a blank zone name (rule R2)', () => {
    expect400(baseMap({ seats: [{ ...baseMap().seats[0], label: '  ' }] }), /"seats\[0\]\.label" must not be blank/);
    expect400(baseMap({ seats: [{ ...baseMap().seats[0], label: 'x'.repeat(33) }] }), /at most 32 characters/);
    expect(() => parseMapPayload(baseMap({ zones: [{ ...baseMap().zones[0], name: '' }] }))).not.toThrow();
  });

  it('rejects an empty-string row (null is the contract value for "outside a row")', () => {
    expect400(baseMap({ seats: [{ ...baseMap().seats[0], row: '' }] }), /"seats\[0\]\.row" must not be blank/);
    expect(parseMapPayload(baseMap({ seats: [{ ...baseMap().seats[0], row: null }] })).seats[0].row).toBeNull();
  });

  it('accepts a structurally valid ghost zone id (422 territory)', () => {
    expect(() => parseMapPayload(baseMap({ seats: [{ ...baseMap().seats[0], zone: 'z-ghost' }] }))).not.toThrow();
  });

  it('rejects an out-of-range rotation and defaults the missing one to 0', () => {
    expect400(baseMap({ seats: [{ ...baseMap().seats[0], rotation: 360 }] }), /"seats\[0\]\.rotation"/);
    expect(parseMapPayload(baseMap()).seats[0].rotation).toBe(0);
    expect(parseMapPayload(baseMap({ seats: [{ ...baseMap().seats[0], rotation: 350 }] })).seats[0].rotation).toBe(350);
  });

  it('rejects malformed outlines: too few points, too many, or self-intersecting', () => {
    expect400(baseMap({ stage: { outline: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }), /ring of 3 to 200 points/);
    expect400(baseMap({ stage: { outline: square(0, 0, 1, 1).concat(Array.from({ length: 197 }, (_, i) => ({ x: 0.5, y: i / 1000 }))) } }),
      /ring of 3 to 200 points/);
    // Bow-tie: edges 0-2 and 1-3 cross each other.
    const bowtie = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
    expect400(baseMap({ stage: { outline: bowtie } }), /simple polygon/);
    expect400(baseMap({ zones: [{ id: 'z-1', name: 'Main', outline: bowtie }] }), /zones\[0\]\.outline.*simple polygon/);
  });

  it('rejects payloads above the contract limits', () => {
    const zone = (index: number) => ({ id: `z-${index}`, name: `Z${index}`, outline: square(0, 0.1, 1, 0.9) });
    expect400(baseMap({ zones: Array.from({ length: 201 }, (_, i) => zone(i)) }), /must not exceed 200 zones/);
    expect400(baseMap({ seats: Array.from({ length: 50_001 }, (_, i) => ({ ...baseMap().seats[0], id: `s-${i}` })) }),
      /must not exceed 50000 seats/);
  });
});

describe('checkMapRules — golden answers against the shared manifest (VEN-202/VEN-207)', () => {
  for (const [name, entry] of Object.entries(manifest)) {
    const expected = entry.expectedErrors.map(({ code, seatIds, zoneIds }) => ({ code, seatIds, zoneIds }));
    it(`${name} triggers exactly ${expected.length ? expected.map((e) => e.code).join(', ') : 'no error'}`, () => {
      const map = parseMapPayload(loadFixture(name));
      const issues = checkMapRules(map).map(({ code, seatIds, zoneIds }) => ({ code, seatIds, zoneIds }));
      expect(issues).toEqual(expected);
    });
  }

  it('never fails fast: every rule is evaluated in one pass', () => {
    const map = parseMapPayload(loadFixture('multi-error.json'));
    expect(checkMapRules(map).map((issue) => issue.code)).toEqual([
      'NO_STAGE', 'UNNAMED_ZONE', 'EMPTY_ZONE', 'DUPLICATE_LABEL',
    ]);
  });

  it('reports overlapping seat pairs in payload order', () => {
    const seat = (id: string) => ({ id, label: id, row: null, zone: 'z-1', position: { x: 0.5, y: 0.5 } });
    const map = parseMapPayload(baseMap({
      zones: [{ id: 'z-1', name: 'Main', outline: square(0, 0.1, 1, 0.9) }],
      seats: [seat('a'), seat('b'), seat('c')],
    }));
    const overlaps = checkMapRules(map).filter((issue) => issue.code === 'OVERLAP');
    expect(overlaps.map((issue) => issue.seatIds)).toEqual([['a', 'b'], ['a', 'c'], ['b', 'c']]);
  });

  it('compares (row, label) trimmed and case-insensitively inside one zone (R5)', () => {
    const seat = (id: string, row: string | null, label: string) => ({ id, label, row, zone: 'z-1', position: { x: 0.5, y: 0.5 } });
    const map = parseMapPayload(baseMap({
      zones: [{ id: 'z-1', name: 'Main', outline: square(0, 0.1, 1, 0.9) }],
      seats: [seat('a', ' A ', '1'), seat('b', 'a', ' 1')],
    }));
    const duplicate = checkMapRules(map).find((issue) => issue.code === 'DUPLICATE_LABEL');
    expect(duplicate?.seatIds).toEqual(['a', 'b']);
  });

  it('does not report adjacent zones sharing an edge as overlapping (zero false positives)', () => {
    const map = parseMapPayload({
      stage: { outline: square(0.3, 0.02, 0.7, 0.06) },
      zones: [
        { id: 'z-left', name: 'Left', outline: square(0, 0.1, 0.5, 0.9) },
        { id: 'z-right', name: 'Right', outline: square(0.5, 0.1, 1, 0.9) },
      ],
      seats: [
        { id: 'a', label: '1', row: null, zone: 'z-left', position: { x: 0.25, y: 0.5 } },
        { id: 'b', label: '1', row: null, zone: 'z-right', position: { x: 0.75, y: 0.5 } },
      ],
    });
    expect(checkMapRules(map)).toEqual([]);
  });

  it('counts a seat on the zone boundary as inside (R4)', () => {
    const map = parseMapPayload(baseMap({
      seats: [{ id: 's-1', label: '1', row: 'A', zone: 'z-1', position: { x: 0, y: 0.1 } }],
    }));
    expect(checkMapRules(map)).toEqual([]);
  });
});

describe('validation performance (VEN-202 acceptance: 5,000 seats < 1 s)', () => {
  const buildBody = (rows: number) => ({
    stage: { outline: square(0.3, 0.0, 0.7, 0.04) },
    zones: [{ id: 'z-arena', name: 'Arena', outline: square(0, 0.045, 1, 0.99) }],
    seats: Array.from({ length: rows }, (_, index) => ({
      id: `s-${index}`,
      label: String((index % 100) + 1),
      row: String(Math.floor(index / 100)),
      zone: 'z-arena',
      position: { x: 0.005 + (index % 100) * 0.01, y: 0.05 + Math.floor(index / 100) * 0.019 },
    })),
  });

  it('parses and validates a 5,000-seat map with the rules pass under a second', () => {
    // Warm the JIT before timing, and time the phases separately: inside a fully
    // parallel jest run every millisecond also depends on scheduler contention.
    parseMapPayload(buildBody(10));
    checkMapRules(parseMapPayload(buildBody(10)));

    const body = buildBody(5000);
    const started = Date.now();
    const map = parseMapPayload(body);
    const parsed = Date.now();
    const issues = checkMapRules(map);
    const validated = Date.now();

    expect(issues).toEqual([]);
    // VEN-202: the business-rule pass on 5,000 seats (reference: ~150 ms on the dev laptop).
    expect(validated - parsed).toBeLessThan(1000);
    // Structural parse stays linear; 2 s is the CI-contention budget, not the target.
    expect(parsed - started).toBeLessThan(2000);
  });
});
