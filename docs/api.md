# API Reference & Contracts

This document contains detailed contract specifications, sample payloads, and security requirements for `venue-service`.

---

## 1. OpenAPI & Swagger Specification

The authoritative OpenAPI 3.0 specification can be found or exported using:

```bash
# Export static OpenAPI definition (when configured)
npm run openapi:generate
```

Interactive Swagger UI documentation is available at `/api-docs` when running in development mode.

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

Validates service liveness.

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

### 3.2 List Venues

Retrieves the catalogue of all registered venues, from every owner. No caching, no pagination.

- **Method**: `GET`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (`VENUE_OWNER` or `ORGANIZER`)
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "1711624800000",
      "name": "Arena Ciudad de Mexico",
      "description": "Large indoor arena for major concerts and events",
      "location": "Avenida de las Granjas 800, Azcapotzalco, CDMX",
      "ownerId": "owner-1",
      "createdAt": "2026-03-28T09:00:00.000Z"
    }
  ]
  ```

---

### 3.3 Register Venue

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
    "id": "1711624950123",
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

### 3.4 Get Venue by ID

Returns a single venue so the event flow can validate that a venue exists.

- **Method**: `GET`
- **Path**: `/venues/{id}` (also accessible via `/api/venues/{id}`)
- **Authentication**: Required (`VENUE_OWNER` or `ORGANIZER`)
- **Response**: `200 OK` with the venue object (same shape as `3.3`)
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `403 Forbidden`: Authenticated role is not a partner role.
  - `404 Not Found`: No venue exists with that ID.
    ```json
    {
      "error": "Venue \"missing-id\" not found"
    }
    ```
