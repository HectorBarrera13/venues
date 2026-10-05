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

Every error response, including unmatched routes and CORS rejections, uses a single shape:

```json
{
  "error": "Venue \"missing-id\" not found"
}
```

The HTTP status carries the meaning: `400` invalid input, `401` missing or invalid token, `403`
authenticated but role not allowed, `404` unknown route or resource, `500` unexpected failure.

---

## 2. Authentication & Authorization

Every venue endpoint requires a partner access token. Verification happens in the backend
(`src/middleware/authenticate.ts` + `src/middleware/requireRole.ts`); the front-end is never trusted.

| Header | Description | Example Value |
|---|---|---|
| `Authorization` | Bearer access token | `Bearer <jwt-token>` |

Token contract (single source of truth: [`src/auth/authConfig.ts`](../src/auth/authConfig.ts)):

| Item | Value |
|---|---|
| Algorithm | `HS256` (fixed explicitly) |
| Secret | `JWT_SECRET` environment variable (never hardcoded) |
| `sub` claim | User id, used as the venue `ownerId` |
| `role` claim | `VENUE_OWNER` or `ORGANIZER` |
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
  -d '{"name":"Estadio Azteca","description":"Stadium","location":"Coyoacan"}' \
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

### 3.3 List Venues

Retrieves the catalogue of all registered venues, from every owner. No caching, no pagination.

- **Method**: `GET`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (`VENUE_OWNER` or `ORGANIZER`)
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "3f7c1b52-9d0e-4a63-8c21-5b6e9a4d2f10",
      "name": "Arena Ciudad de Mexico",
      "description": "Large indoor arena for major concerts and events",
      "location": "Avenida de las Granjas 800, Azcapotzalco, CDMX",
      "ownerId": "owner-1",
      "createdAt": "2026-03-28T09:00:00.000Z"
    }
  ]
  ```

---

### 3.4 Register Venue

Creates a new physical venue record. The `ownerId` is automatically attributed from the authenticated context.

- **Method**: `POST`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (`role: "VENUE_OWNER"`, otherwise `403`)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt-token>`
- **Notes**: `ownerId` and any other extra field in the body are ignored; the owner is always the `sub` claim of the token.
- **Request Body**:
  ```json
  {
    "name": "Estadio Azteca",
    "description": "Multi-purpose stadium for sports and mass events",
    "location": "Calzada de Tlalpan 3465, Coyoacan, CDMX"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": "8e2a4d19-77c3-4f50-b6e8-1a9d3c7b5e24",
    "name": "Estadio Azteca",
    "description": "Multi-purpose stadium for sports and mass events",
    "location": "Calzada de Tlalpan 3465, Coyoacan, CDMX",
    "ownerId": "owner-1",
    "createdAt": "2026-03-28T09:02:30.123Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing mandatory fields (`name`, `description`, `location`).
    ```json
    {
      "error": "Field \"name\" is required"
    }
    ```
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `403 Forbidden`: Authenticated user does not possess `VENUE_OWNER` permissions.

---

### 3.5 Get Venue by ID

Returns a single venue so the event flow can validate that a venue exists.

- **Method**: `GET`
- **Path**: `/venues/{id}` (also accessible via `/api/venues/{id}`)
- **Authentication**: Required (`VENUE_OWNER` or `ORGANIZER`)
- **Response**: `200 OK` with the venue object (same shape as `3.4`)
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `403 Forbidden`: Authenticated role is not a partner role.
  - `404 Not Found`: No venue exists with that ID.
    ```json
    {
      "error": "Venue \"missing-id\" not found"
    }
    ```

---

### 3.6 Unknown Route

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
