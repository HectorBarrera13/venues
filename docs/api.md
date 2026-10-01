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

## 2. Authentication & Headers

Mutating endpoints require authentication. During local development and testing, identity resolution is performed via the `x-mock-user` request header.

| Header | Description | Example Value |
|---|---|---|
| `x-mock-user` | Simulated user identifier for local testing | `venue-owner-1` or `organizer-1` |
| `Authorization` | Bearer JWT token (production flow) | `Bearer <jwt-token>` |

> Note: If `x-mock-user` is not provided in local environments, `CurrentUserProvider` defaults to `venue-owner-1` (role: `venue_owner`).

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
      "ownerId": "venue-owner-1",
      "createdAt": "2026-03-28T09:00:00.000Z"
    }
  ]
  ```

---

### 3.3 Register Venue

Creates a new physical venue record. The `ownerId` is automatically attributed from the authenticated context.

- **Method**: `POST`
- **Path**: `/venues` (also accessible via `/api/venues`)
- **Authentication**: Required (`role: "venue_owner"`)
- **Headers**:
  - `Content-Type: application/json`
  - `x-mock-user: venue-owner-1` (or bearer token in production)
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
    "ownerId": "venue-owner-1",
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
  - `403 Forbidden`: Authenticated user does not possess `venue_owner` permissions.
