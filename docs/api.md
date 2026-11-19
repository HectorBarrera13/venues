# API Reference & Contracts

This document contains detailed contract specifications, sample payloads, and security requirements for `venue-service`.

---

## 1. OpenAPI & Swagger Specification

The authoritative OpenAPI 3.0 specification can be found or exported using:

```bash
npm run openapi:generate
```

The definition lives in [`src/openapi/definition.ts`](../src/openapi/definition.ts) and is written to
`openapi.json` without starting the server or opening a browser. There is no interactive Swagger UI:
the committed `openapi.json` is the contract of record for the other teams. CI regenerates it and fails
if the result differs from the committed file, so the contract cannot drift away from the routes.

### Error format

Every error response, including unmatched routes and CORS rejections, carries an `error` message.
Some statuses add machine-readable fields next to it (`existingVenueId` on `409`, `errors` on `422`):

```json
{
  "error": "Venue \"missing-id\" not found"
}
```

The HTTP status carries the meaning: `400` invalid input, `401` missing or invalid token, `403`
authenticated but role not allowed, `404` unknown route or resource, `409` duplicate venue, `422` seat map
rejected by a business rule, `500` unexpected failure, `501` route defined in the contract but not
implemented yet.

---

## 2. Authentication & Authorization

Venue routes require a valid JWT bearer access token. Verification happens in the backend
(`src/middleware/authenticate.ts` + `src/middleware/requireRole.ts`); the front-end is never trusted.
Read endpoints (`GET /venues`, `GET /venues/{id}`) accept any authenticated role (`VENUE_OWNER`, `ORGANIZER`, `FAN`, etc.); write endpoints require `VENUE_OWNER`.

### Route Authorization Table

| Method | Path | Authentication / Allowed Roles | Notes |
|---|---|---|---|
| `GET` | `/health` | Public (none) | Process liveness |
| `GET` | `/ready` | Public (none) | Store readiness (`venue-db`) |
| `GET` | `/venues` | Authenticated (any role) | Returns only venues with `latestMapVersion >= 1` |
| `GET` | `/venues/{id}` | Authenticated (any role) | Returns venue metadata including `latestMapVersion` |
| `POST` | `/venues` | Authenticated (`VENUE_OWNER`) | `403` for other roles |
| `POST` | `/venues/{id}/map` | Authenticated (`VENUE_OWNER` + owner) | `201` new immutable version; `403` other roles or non-owner |
| `GET` | `/venues/{id}/map` | Authenticated (`VENUE_OWNER`, `ORGANIZER`) | `200` latest or `?version=N`; `400` on invalid `version`; `404` venue without map |

| Header | Description | Example Value |
|---|---|---|
| `Authorization` | Bearer access token | `Bearer <jwt-token>` |

Token contract (single source of truth: [`src/auth/authConfig.ts`](../src/auth/authConfig.ts)):

| Item | Value |
|---|---|
| Algorithm | `HS256` (fixed explicitly) |
| Secret | `JWT_SECRET` environment variable (never hardcoded) |
| `sub` claim | User id, used as the venue `ownerId` |
| `role` claim | `VENUE_OWNER`, `ORGANIZER`, `FAN`, etc. |
| `exp` claim | Expiration, enforced on every request |

| Situation | Response |
|---|---|
| Missing, malformed, tampered or expired token | `401 Unauthorized` |
| Valid token with a role not allowed on the route | `403 Forbidden` |

For local development, mint a token with the same secret the service uses:

```bash
export TOKEN=$(scripts/make-token --role VENUE_OWNER --sub owner-1)
export EXPIRED_TOKEN=$(scripts/make-token --role ORGANIZER --sub organizer-1 --expired)

curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Estadio Azteca","address":"Calzada de Tlalpan 3465","city":"Ciudad de Mexico","country":"MX","location":{"lat":19.3029,"lng":-99.1505}}' \
  http://localhost:3000/venues
```

There is no login endpoint and no middleware bypass in this service: token issuing belongs to the Auth
team, and `scripts/make-token` only signs tokens with the shared secret.

---

## 3. Endpoints

### 3.1 Health Check

Process liveness. Does not reach any dependency, so it stays `200` even when the venue store is down.

- **Method**: `GET`
- **Path**: `/health`
- **Authentication**: None
- **Response**: `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

---

### 3.2 Readiness Check

Dependency readiness. Pings the venue store, so an orchestrator can stop routing traffic to a replica
that cannot serve requests.

- **Method**: `GET`
- **Path**: `/ready`
- **Authentication**: None
- **Response**: `200 OK` when the venue store answers
  ```json
  {
    "status": "ready",
    "venueStore": "up"
  }
  ```
- **Response**: `503 Service Unavailable` when the venue store is unreachable
  ```json
  {
    "status": "not_ready",
    "venueStore": "down"
  }
  ```

The probe gives up after 2 seconds, so the response arrives quickly even while the store is unreachable.

---

### 3.3 List & Search Venues

Paginated search across registered venues that have at least one saved map (`latestMapVersion >= 1`). Venues without a map (`latestMapVersion === 0`) are excluded because they cannot host events.

- **Method**: `GET`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (any authenticated role; `401` if missing/invalid)
- **Query parameters**:

  | Name | Type | Default | Rule |
  |---|---|---|---|
  | `page` | integer | `1` | `>= 1` |
  | `limit` | integer | `20` | `1..100` |
  | `lat`, `lng`, `radius_km` | number | — | All three or none; `lat` in `[-90, 90]`, `lng` in `[-180, 180]`, `radius_km` in `(0, 500]` |
  | `country` | string | — | ISO 3166-1 alpha-2 (normalized upper case) |
  | `city` | string | — | Non-empty; matched case- and accent-insensitively |
  | `name` | string | — | Non-empty partial match, case- and accent-insensitive |

- **Behavior & Index Strategy**:
  - **Geospatial search (`lat`, `lng`, `radius_km`)**: Executes a MongoDB `$geoNear` pipeline backed by the `venues_location_2dsphere` index (`location: '2dsphere'`, inclusive `maxDistance = radius_km * 1000` m), ordered strictly ascending by distance. Each item includes `distance_km` rounded to 2 decimal places (spherical distance matches Haversine within ~0.3% / ±0.05 km at typical city radii). Non-geospatial queries omit `distance_km`.
  - **Name search (`name`)**: Normalizes the query with `normalizeVenueName` (NFD diacritic stripping, lower-casing, punctuation collapsed to spaces) and matches against the indexed `nameNormalized` field using an escaped substring regex (`contains` semantics). Unlike a bounded prefix regex (`^prefix`), substring matching scans `nameNormalized` index keys, narrowed first by `latestMapVersion >= 1` and optional `country`/`city` filters.
  - **Zero matches & out-of-range pages**: Always returns `200` with `data: []` and consistent `pagination` (`totalPages = Math.ceil(total / limit)`), never `404`.
  - **Unknown query params**: Ignored.
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "3f7c1b52-9d0e-4a63-8c21-5b6e9a4d2f10",
        "name": "Arena Ciudad de Mexico",
        "description": "Large indoor arena for major concerts and events",
        "address": "Avenida de las Granjas 800, Azcapotzalco",
        "city": "Ciudad de Mexico",
        "country": "MX",
        "location": { "lat": 19.4894, "lng": -99.1830 },
        "externalId": "282893735",
        "externalSource": "nominatim",
        "osmRef": "way:123456",
        "latestMapVersion": 1,
        "ownerId": "owner-1",
        "createdAt": "2026-03-28T09:00:00.000Z",
        "distance_km": 4.12
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid coordinates or radius returns:
    ```json
    { "error": "Invalid coordinates or radius" }
    ```
    Incomplete location triplets (`lat` without `lng`/`radius_km`), invalid pagination (`page`/`limit`), or invalid `country`/`city`/`name` also return `400`.
  - `401 Unauthorized`: Missing or invalid authentication token.

---

### 3.4 Register Venue

Creates a new physical venue record. The `ownerId` is automatically attributed from the authenticated context.

- **Method**: `POST`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (`role: "VENUE_OWNER"`, otherwise `403`)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt-token>`
- **Notes**: `ownerId` and any other unknown field in the body are ignored; the owner is always the `sub`
  claim of the token. `location` is stored as a GeoJSON Point (`[lng, lat]`, WGS84) but the API always
  speaks `{ lat, lng }`.
- **Request Body**:
  ```json
  {
    "name": "Estadio Azteca",
    "description": "Multi-purpose stadium for sports and mass events",
    "address": "Calzada de Tlalpan 3465, Santa Ursula Coapa",
    "city": "Ciudad de Mexico",
    "country": "MX",
    "location": { "lat": 19.3029, "lng": -99.1505 },
    "externalId": "282893735",
    "externalSource": "nominatim",
    "osmRef": "way:24930346"
  }
  ```

  | Field | Required | Rule |
  |---|---|---|
  | `name`, `address`, `city` | yes | Non-empty string, max 200 chars (trimmed) |
  | `country` | yes | ISO 3166-1 alpha-2, stored upper-case |
  | `location.lat` / `location.lng` | yes | Numbers in `[-90, 90]` / `[-180, 180]` |
  | `description` | no | String or `null` |
  | `externalId` | no | Requires `externalSource` |
  | `externalSource` | no | Geocoder name, e.g. `"nominatim"` |
  | `osmRef` | no | `node:<id>`, `way:<id>` or `relation:<id>`; unique among venues |
- **Response**: `201 Created`
  ```json
  {
    "id": "8e2a4d19-77c3-4f50-b6e8-1a9d3c7b5e24",
    "name": "Estadio Azteca",
    "description": "Multi-purpose stadium for sports and mass events",
    "address": "Calzada de Tlalpan 3465, Santa Ursula Coapa",
    "city": "Ciudad de Mexico",
    "country": "MX",
    "location": { "lat": 19.3029, "lng": -99.1505 },
    "externalId": "282893735",
    "externalSource": "nominatim",
    "osmRef": "way:24930346",
    "latestMapVersion": 0,
    "ownerId": "owner-1",
    "createdAt": "2026-03-28T09:02:30.123Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: A field is missing or invalid; the message names it.
    ```json
    { "error": "Field \"country\" must be an ISO 3166-1 alpha-2 country code" }
    ```
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `403 Forbidden`: Authenticated user does not possess `VENUE_OWNER` permissions.
  - `409 Conflict`: A venue with the same `osmRef` already exists.
    ```json
    { "error": "A venue with osmRef \"way:24930346\" already exists", "existingVenueId": "8e2a4d19-77c3-4f50-b6e8-1a9d3c7b5e24" }
    ```

---

### 3.5 Get Venue by ID

Returns a single venue (including `latestMapVersion` and `ownerId`, without map geometry) so clients and event flows can inspect venue details or decide edit permissions. Venues without a map return `latestMapVersion: 0`.

- **Method**: `GET`
- **Path**: `/venues/{id}` (also accessible via `/api/venues/{id}`)
- **Authentication**: Required (any authenticated role)
- **Response**: `200 OK` with the venue object (same shape as `3.4`)
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `404 Not Found`: No venue exists with that ID.
    ```json
    {
      "error": "Venue \"missing-id\" not found"
    }
    ```

---

### 3.6 Seat Map

Full format, rules and examples: [`docs/map-format.md`](map-format.md).

| Method | Path | Roles | Statuses |
|---|---|---|---|
| `POST` | `/venues/{id}/map` | `VENUE_OWNER` + owner of the venue | `201`, `400`, `401`, `403`, `404`, `422` |
| `GET` | `/venues/{id}/map[?version=N]` | any authenticated partner role | `200`, `400`, `401`, `404` |

Both are also mounted under `/api/venues/{id}/map`. Map bodies may be up to 10 MB.

**Saving (`POST`).** Check order: `401` missing token, `403` role or non-owner, `404`
unknown venue, `400` malformed payload (field path in the message), `422` with
`{ "error": "Map validation failed", "errors": [...] }` listing every rule violation at
once. On success the payload is stored **transactionally** as version
`latestMapVersion + 1` and `Venue.latestMapVersion` moves with it in the same
transaction; concurrent saves are serialized by the unique `(venueId, version)` index
(the loser retries on the fresh pointer), so two saves never collide or lose an update.

**Immutability (VEN-205).** Stored versions are never updated or deleted: the map
repository exposes only `saveNewVersion`, `findLatest` and `findByVenueVersion`, and no
route mutates map data. `GET /venues/{id}/map?version=n` always returns the identical
document, including its seat and zone ids.

**Seat id stability (VEN-206).** Within version `n`, a `seat.id` always identifies the
same physical seat of version `n`; ids are provided by the editor, validated as unique
per version and never rewritten by the backend. The same id in different versions is
possible but carries no implicit relationship. Booking and Events should reference a
seat as `(venueId, version, seatId)`.

**Reading (`GET`).** Without `version` returns the latest; with `?version=N` the exact
one. `404` when the venue does not exist, has no map yet (`latestMapVersion === 0`) or
the version was never saved. Non-integer or non-positive `version` is `400`.

---

### 3.7 Unknown Route

Any path that matches no router is answered with the same error shape.

- **Method**: Any
- **Path**: Any unmatched path
- **Authentication**: None
- **Response**: `404 Not Found`
  ```json
  {
    "error": "Route GET /does-not-exist not found"
  }
  ```
