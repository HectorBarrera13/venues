# Seat Map Format (contract v1)

This is the single contract for the vector seat map that the Backstage editor sends and `venue-service`
stores. The editor (VEN-501/507/508), the validators (VEN-201/202), the OpenAPI definition (VEN-003) and the
shared fixtures (VEN-004) all follow it. **Nobody adds, renames or reinterprets a field outside this document.**
A change here is a contract change and needs the same sign-off as CP-0.

- TypeScript source of truth: [`src/maps/mapFormat.ts`](../src/maps/mapFormat.ts)
- OpenAPI schemas: `MapPayload`, `MapVersion`, `MapValidationErrors` in [`openapi.json`](../openapi.json)
- Fixtures: [`tests/fixtures/maps/`](../tests/fixtures/maps) with [`manifest.json`](../tests/fixtures/maps/manifest.json)

---

## 1. Endpoints

| Method | Path | Body | Success |
|---|---|---|---|
| `POST` | `/venues/{id}/map` | `MapPayload` | `201` with the stored `MapVersion` |
| `GET` | `/venues/{id}/map` | — | `200` with the latest `MapVersion` |
| `GET` | `/venues/{id}/map?version=N` | — | `200` with version `N` |

Every save creates a **new immutable version** `latestMapVersion + 1` (the first save is `1`). Versions are
never updated or deleted. `Venue.latestMapVersion` is `0` while the venue has no map.

---

## 2. Coordinate system

All geometry is **normalized** to the map canvas:

- `x` and `y` are numbers in the closed range **`[0, 1]`**.
- Origin is the **top-left** corner; `x` grows to the right, `y` grows downwards.
- Precision is **4 decimals**. The editor rounds every coordinate before sending
  (`roundCoordinate` in `mapFormat.ts`: half away from zero, e.g. `0.12345 → 0.1235`).
  The backend applies the same rounding before validating and storing, so extra decimals never change the
  outcome; it does **not** clamp.
- Any coordinate `< 0`, `> 1`, `NaN`, infinite or not a number is **rejected with `400`**.

```ts
interface Point { x: number; y: number }   // 0..1, 4 decimals
```

---

## 3. Payload

```ts
interface MapPayload {
  stage: Stage | null;   // null (or missing) -> 422 NO_STAGE
  zones: Zone[];         // 0..200
  seats: Seat[];         // 0..50 000
}

interface Stage {
  label?: string | null; // optional caption, max 100 chars
  outline: Point[];      // polygon ring, 3..200 points
}

interface Zone {
  id: string;            // ^[A-Za-z0-9_-]{1,64}$, unique in the map
  name: string;          // max 100 chars; blank -> 422 UNNAMED_ZONE
  outline: Point[];      // polygon ring, 3..200 points
}

interface Seat {
  id: string;            // ^[A-Za-z0-9_-]{1,64}$, unique in the map
  label: string;         // non-blank, max 32 chars, e.g. "12"
  row: string | null;    // max 32 chars, e.g. "A"; null for seats outside a row
  zone: string | null;   // id of the owning zone
  position: Point;       // centre of the seat
  rotation?: number;     // clockwise degrees in [0, 360); default 0
}
```

### 3.1 Outlines (stage and zones)

- An outline is a **ring of points**: at least 3, at most 200, listed in drawing order (either winding).
- The ring is **implicitly closed**: do not repeat the first point at the end.
- The polygon must be simple (its edges do not cross each other). A self-intersecting outline is a
  malformed payload (`400`).

### 3.2 Identifiers

- Seat and zone ids match `^[A-Za-z0-9_-]{1,64}$` and are **unique across the whole map**
  (a seat and a zone cannot share an id). Duplicate ids are a malformed payload (`400`).
- Ids are **stable across versions**: when a seat or zone is moved, renamed or re-labelled in a new version it
  keeps its id. New elements get new ids, and the id of a deleted element is never reused. Booking and Events
  reference seats by id, so the editor must preserve them.
- The backend never generates or rewrites ids.

### 3.3 Seat identity for people

Within one zone, the pair **(`row`, `label`)** identifies a seat for buyers and staff. It is compared after
trimming and case-insensitively, with `row: null` treated as its own row.

---

## 4. Responses

### 4.1 `MapVersion` (201 and 200)

```json
{
  "venueId": "8e2a4d19-77c3-4f50-b6e8-1a9d3c7b5e24",
  "version": 1,
  "createdAt": "2026-11-18T10:00:00.000Z",
  "stage": { "label": "Main stage", "outline": [ ... ] },
  "zones": [ ... ],
  "seats": [ ... ]
}
```

The stored `stage`, `zones` and `seats` are the request values after coordinate rounding and with
`rotation` defaulted to `0`.

### 4.2 Status codes

| Status | When | Body |
|---|---|---|
| `201` | Map saved as a new version | `MapVersion` |
| `400` | Malformed payload: wrong types, missing arrays, coordinates out of range, bad or duplicate ids, limits exceeded, self-intersecting outline. Also an invalid `?version` on `GET`. | `{ "error": "..." }` |
| `401` | Missing or invalid token | `{ "error": "..." }` |
| `403` | Not `VENUE_OWNER`, or not the owner of this venue | `{ "error": "..." }` |
| `404` | Unknown venue; on `GET`, no map yet or unknown version | `{ "error": "..." }` |
| `422` | Well-formed payload that breaks a business rule (section 5) | `MapValidationErrors` |

### 4.3 `422` body

```ts
interface MapValidationErrors {
  error: "Map validation failed";
  errors: Array<{
    code: "NO_STAGE" | "UNNAMED_ZONE" | "EMPTY_ZONE" | "SEAT_WITHOUT_ZONE" | "DUPLICATE_LABEL" | "OVERLAP";
    message: string;      // human-readable, not part of the contract (do not parse it)
    seatIds?: string[];   // offending seats, in payload order
    zoneIds?: string[];   // offending zones, in payload order
  }>;
}
```

- The validator checks **every** rule and returns **all** violations in one answer (never fail-fast).
- `errors` is ordered by code as listed in the catalogue below, then by payload order.
- `seatIds` / `zoneIds` are present only when the rule names elements, and never empty.

---

## 5. Business rules and error catalogue

| # | Rule | Code | Ids | Grouping |
|---|---|---|---|---|
| R1 | The map has a stage (`stage` is not `null` / missing) | `NO_STAGE` | — | one error |
| R2 | Every zone has a non-blank `name` | `UNNAMED_ZONE` | `zoneIds` | one error listing every unnamed zone |
| R3 | Every zone contains at least one seat | `EMPTY_ZONE` | `zoneIds` | one error listing every empty zone |
| R4 | Every seat references an existing zone (`zone` not null, id exists) and its `position` lies inside that zone's outline (the boundary counts as inside) | `SEAT_WITHOUT_ZONE` | `seatIds` | one error listing every such seat |
| R5 | Within a zone, (`row`, `label`) is unique (section 3.3) | `DUPLICATE_LABEL` | `seatIds` + `zoneIds` | one error per duplicated pair value, listing all its seats |
| R6a | Two seat centres are at least `0.005` apart (Euclidean distance, normalized units) | `OVERLAP` | `seatIds` | one error per overlapping pair |
| R6b | Two zone outlines do not overlap (their interiors do not intersect; sharing an edge or a vertex is allowed) | `OVERLAP` | `zoneIds` | one error per overlapping pair |

A seat that triggers R4 because its zone does not exist is not checked against R5 (it has no zone).

---

## 6. Examples

### 6.1 Valid request (complete)

```json
{
  "stage": {
    "label": "Main stage",
    "outline": [
      { "x": 0.3, "y": 0.05 }, { "x": 0.7, "y": 0.05 }, { "x": 0.7, "y": 0.15 }, { "x": 0.3, "y": 0.15 }
    ]
  },
  "zones": [
    {
      "id": "z-floor",
      "name": "Floor",
      "outline": [
        { "x": 0.1, "y": 0.25 }, { "x": 0.9, "y": 0.25 }, { "x": 0.9, "y": 0.55 }, { "x": 0.1, "y": 0.55 }
      ]
    },
    {
      "id": "z-balcony",
      "name": "Balcony",
      "outline": [
        { "x": 0.1, "y": 0.65 }, { "x": 0.9, "y": 0.65 }, { "x": 0.9, "y": 0.9 }, { "x": 0.1, "y": 0.9 }
      ]
    }
  ],
  "seats": [
    { "id": "s-fa1", "label": "1", "row": "A", "zone": "z-floor", "position": { "x": 0.45, "y": 0.3 } },
    { "id": "s-fa2", "label": "2", "row": "A", "zone": "z-floor", "position": { "x": 0.5, "y": 0.3 } },
    { "id": "s-bb1", "label": "1", "row": "B", "zone": "z-balcony", "position": { "x": 0.45, "y": 0.7 }, "rotation": 350 },
    { "id": "s-bb2", "label": "2", "row": "B", "zone": "z-balcony", "position": { "x": 0.5, "y": 0.7 }, "rotation": 10 }
  ]
}
```

Response `201`:

```json
{
  "venueId": "8e2a4d19-77c3-4f50-b6e8-1a9d3c7b5e24",
  "version": 1,
  "createdAt": "2026-11-18T10:00:00.000Z",
  "stage": { "label": "Main stage", "outline": ["...as sent..."] },
  "zones": ["...as sent..."],
  "seats": [
    { "id": "s-fa1", "label": "1", "row": "A", "zone": "z-floor", "position": { "x": 0.45, "y": 0.3 }, "rotation": 0 },
    "..."
  ]
}
```

A larger valid map (blocks of rows, loose seats, rotations) is
[`tests/fixtures/maps/valid-v1.json`](../tests/fixtures/maps/valid-v1.json).

### 6.2 One request per error code

Each example is the valid request of 6.1 with only the shown change.

**`NO_STAGE`** — `"stage": null`

```json
{ "error": "Map validation failed", "errors": [
  { "code": "NO_STAGE", "message": "The map has no stage" }
] }
```

**`UNNAMED_ZONE`** — balcony renamed to blank: `{ "id": "z-balcony", "name": "  ", ... }`

```json
{ "error": "Map validation failed", "errors": [
  { "code": "UNNAMED_ZONE", "message": "1 zone has no name", "zoneIds": ["z-balcony"] }
] }
```

**`EMPTY_ZONE`** — a third zone without seats is added:
`{ "id": "z-vip", "name": "VIP", "outline": [ {"x":0.1,"y":0.92}, {"x":0.3,"y":0.92}, {"x":0.3,"y":0.98}, {"x":0.1,"y":0.98} ] }`

```json
{ "error": "Map validation failed", "errors": [
  { "code": "EMPTY_ZONE", "message": "1 zone has no seats", "zoneIds": ["z-vip"] }
] }
```

**`SEAT_WITHOUT_ZONE`** — a seat with no zone is added:
`{ "id": "s-lost", "label": "1", "row": null, "zone": null, "position": { "x": 0.05, "y": 0.6 } }`

```json
{ "error": "Map validation failed", "errors": [
  { "code": "SEAT_WITHOUT_ZONE", "message": "1 seat is not inside a zone", "seatIds": ["s-lost"] }
] }
```

**`DUPLICATE_LABEL`** — `s-fa2` re-labelled `"1"` (same row `A`, same zone as `s-fa1`)

```json
{ "error": "Map validation failed", "errors": [
  { "code": "DUPLICATE_LABEL", "message": "Seat A-1 appears 2 times in zone z-floor",
    "seatIds": ["s-fa1", "s-fa2"], "zoneIds": ["z-floor"] }
] }
```

**`OVERLAP` (seats)** — `s-fa2` moved onto `s-fa1`: `"position": { "x": 0.452, "y": 0.3 }`

```json
{ "error": "Map validation failed", "errors": [
  { "code": "OVERLAP", "message": "Seats s-fa1 and s-fa2 overlap", "seatIds": ["s-fa1", "s-fa2"] }
] }
```

**`OVERLAP` (zones)** — balcony outline starts at `y = 0.5`, inside the floor:
`[ {"x":0.1,"y":0.5}, {"x":0.9,"y":0.5}, {"x":0.9,"y":0.9}, {"x":0.1,"y":0.9} ]`

```json
{ "error": "Map validation failed", "errors": [
  { "code": "OVERLAP", "message": "Zones z-floor and z-balcony overlap", "zoneIds": ["z-floor", "z-balcony"] }
] }
```

### 6.3 Several violations at once

With `"stage": null`, the balcony renamed to `""` and the `z-vip` zone above added, the single answer is:

```json
{ "error": "Map validation failed", "errors": [
  { "code": "NO_STAGE", "message": "The map has no stage" },
  { "code": "UNNAMED_ZONE", "message": "1 zone has no name", "zoneIds": ["z-balcony"] },
  { "code": "EMPTY_ZONE", "message": "1 zone has no seats", "zoneIds": ["z-vip"] }
] }
```

### 6.4 Malformed payload (400, not 422)

`"position": { "x": 1.2, "y": 0.3 }`

```json
{ "error": "Field \"seats[0].position.x\" must be a number between 0 and 1" }
```

---

## 7. Front-end checklist

- Round every coordinate to 4 decimals and keep it inside `[0, 1]` before sending.
- Keep ids stable across saves; never reuse an id.
- Always send `stage` (or `null`), `zones` and `seats`; omit nothing else from the shapes above and add nothing.
- Render `422` errors from `code` + `seatIds` / `zoneIds`; treat `message` as display text only.

---

## 8. Shared fixtures

[`tests/fixtures/maps/`](../tests/fixtures/maps) is the single source of truth for test maps, used as-is by
the backend and the front (never copied or edited by hand in another repository).

| File | Expected result |
|---|---|
| `valid-v1.json` | No error. Stage, three zones (one non-rectangular), row blocks, loose seats, rotations |
| `seat-without-zone.json` | `SEAT_WITHOUT_ZONE`: zone `null`, unknown zone id, position outside its zone |
| `empty-zone.json` | `EMPTY_ZONE` |
| `overlap-seats.json` | `OVERLAP` (two seats 0.003 apart) |
| `overlap-zones.json` | `OVERLAP` (two zone outlines) |
| `unnamed-zone.json` | `UNNAMED_ZONE` |
| `duplicate-label.json` | `DUPLICATE_LABEL` |
| `no-stage.json` | `NO_STAGE` |
| `multi-error.json` | `NO_STAGE`, `UNNAMED_ZONE`, `EMPTY_ZONE`, `DUPLICATE_LABEL` in one answer |

[`manifest.json`](../tests/fixtures/maps/manifest.json) lists, for each file, the exact `errors` expected
(`code`, `seatIds`, `zoneIds`; `message` is free text and left out). Any validator — backend VEN-202 or a
front-side pre-check — is tested by loading each file and comparing its output with the manifest.
`tests/mapFixtures.test.ts` already does so against a reference implementation of section 5, and also checks
that every fixture is well-formed (no `400`).

The front consumes the files from this repository at the same relative path
(`tests/fixtures/maps/<file>`), e.g. through a git submodule or a pinned raw download in its test setup.
