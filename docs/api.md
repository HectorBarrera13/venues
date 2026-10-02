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

All mutating endpoints (`POST /venues`, `POST /api/venues`) require Bearer token authentication and role-based authorization (`VENUE_OWNER`).

### 2.1 Production Authentication

In production, `venue-service` acts as a JWT Resource Server verifying signed tokens issued by the Auth Service.

| Header | Description | Example Value |
|---|---|---|
| `Authorization` | Bearer JWT token | `Bearer <jwt-token>` |

- **401 Unauthorized**: Missing `Authorization` header, non-Bearer scheme, malformed token, invalid signature, disallowed algorithm, expired token (`exp`), token older than 8 hours (`iat`), or invalid mandatory claims.
- **403 Forbidden**: Authenticated principal does not possess the `VENUE_OWNER` role (e.g. `ORGANIZER` or `FAN`).

### 2.2 Local Development & Testing (`AUTH_MODE=mock`)

For local testing and automated tests without JWT signing, setting `AUTH_MODE=mock` enables the `MockTokenVerifier` sourced from `shared/mocks/mockUsers.ts`.

- Pass `Authorization: Bearer user-001` to authenticate as Carlos Méndez (`VENUE_OWNER`).
- Pass `Authorization: Bearer user-002` to authenticate as Ana García (`ORGANIZER`, resulting in `403 Forbidden`).
- Note: `AUTH_MODE=mock` is forbidden in production (`NODE_ENV=production`) and will fail application startup.

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

Retrieves the catalogue of all registered venues.

- **Method**: `GET`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: None (public read-access for event scheduling and search indexing)
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "1711624800000",
      "name": "Arena Ciudad de Mexico",
      "description": "Large indoor arena for major concerts and events",
      "location": "Avenida de las Granjas 800, Azcapotzalco, CDMX",
      "ownerId": "user-001",
      "createdAt": "2026-03-28T09:00:00.000Z"
    }
  ]
  ```

---

### 3.3 Register Venue

Creates a new physical venue record. The `ownerId` is attributed exclusively from the authenticated principal's `userId`. Any attempt to supply `ownerId` or `authorId` in the request body is rejected.

- **Method**: `POST`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (`Bearer <JWT>` with role `VENUE_OWNER`)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
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
    "ownerId": "user-001",
    "createdAt": "2026-03-28T09:02:30.123Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing mandatory fields (`name`, `description`, `location`) or attempting to inject `ownerId`/`authorId`.
    ```json
    {
      "error": "Field \"name\" is required"
    }
    ```
    ```json
    {
      "error": "Injecting ownerId or authorId is not allowed"
    }
    ```
  - `401 Unauthorized`: Missing or invalid authentication token, expired, or token older than 8 hours.
    ```json
    {
      "error": "Unauthorized"
    }
    ```
  - `403 Forbidden`: Authenticated user does not possess `VENUE_OWNER` permissions.
    ```json
    {
      "error": "Forbidden"
    }
    ```
