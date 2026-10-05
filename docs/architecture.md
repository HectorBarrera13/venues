# Architecture & Domain Design

This document details the architectural principles, layer boundaries, and domain model of the `venue-service`.

---

## 1. Domain Overview

The `venue-service` is the authoritative component for the **Venues Domain** within the Ticket D-Saster platform:
- Maintains physical venue configurations, locations, and metadata.
- Serves as the catalogue consumed by `event-service` (Team Aura) and `search-service` (Team Error200).
- Integrates with the partner administration portal (`Backstage`) for Venue Owners.

The service is a **resource server** for authentication: the Auth service (Team Ninjava) issues the tokens and
this service only verifies them and enforces role rules. There is no login endpoint and no auth bypass here.

### 1.1 What this service does not own

Boundaries matter as much as responsibilities. The following belong to other bounded contexts and must never
be written from this service:

| Concern | Owner |
|---|---|
| Seat availability, holds, inventory state | `Tickets Store` via `Booking Service` (Sap-atitos) |
| Event scheduling, seat tiering, pricing | `Event Store` via `Event Service` (Aura) |
| Event search and indexing | `Events Store` via `Search Service` (Error200) |
| User identity, credentials, token issuing | `User Store` via `Auth Service` (Ninjava) |
| Payments | `Payment Service` (Ninjava) |

`venue-service` owns the **physical definition** of a venue and its seating topology: the venue record and,
in the seat-map phase, its sections, rows, and seats.

---

## 2. Layer Responsibilities

Requests flow in one direction, and each layer may only call the one below it:

```
HTTP request
  → middleware/     security, cross-cutting concerns
  → routes/         path and method mapping
  → controllers/    request/response translation
  → services/       use cases, validation rules, authorization decisions
  → repositories/   persistence
  → venue store     MongoDB
```

- **Routing (`src/routes/`)**:
  Maps paths and HTTP methods to handlers and attaches the middleware chain. `venueRoutes` mounts the same
  router on both `/venues` and `/api/venues`, so either prefix reaches the same handlers.

- **Controllers (`src/controllers/`)**:
  Translate between HTTP and the application layer: read request data, call the service, and render the
  result. They hold no business rules, never touch Prisma, and **never render an error response** — every
  thrown value is forwarded to `next(error)`.

- **Application Services (`src/services/`)**:
  Encapsulate the use cases (`VenueService`, `ReadinessService`). Enforce validation rules, coordinate
  persistence through repository interfaces, and resolve owner identity from the authenticated context.

- **Domain Model (`src/entities/`)**:
  Pure `Venue` entity with domain invariants and serialization helpers, free of framework dependencies.

- **Repositories (`src/repositories/`)**:
  The only code that talks to Prisma. `VenueRepository` implements the `VenueStore` contract that the
  service depends on, so the adapter can be replaced without touching domain rules.

---

## 3. Cross-Cutting Concerns

### 3.1 Security

`src/middleware/authenticate.ts` verifies the bearer token in the backend (signature, explicit `HS256`
algorithm, expiration) and `src/middleware/requireRole.ts` enforces role rules before any handler runs.
Missing, tampered, or expired tokens produce `401`; an authenticated request with a role not allowed on the
route produces `403`. Claim names, role values, and the secret location are declared once in
`src/auth/authConfig.ts`.

### 3.2 Error handling

There is exactly one place where an error becomes an HTTP response: `src/middleware/errorHandler.ts`.

- `src/errors/ApiError.ts` carries the status a client must observe, with factories for `400`, `401`,
  `403`, `404`, and `500`.
- `toHttpError()` maps any thrown value onto a status and message. `ApiError` reports its own status;
  errors from third-party code (Prisma, body parsers) may expose `status` or `statusCode`; anything
  unrecognized degrades to `500`.
- `src/middleware/notFound.ts` turns unmatched routes into `404` before `errorHandler` runs.

Every error response uses one shape, including 404s and CORS rejections:

```json
{ "error": "Venue \"missing-id\" not found" }
```

### 3.3 Health and readiness

`GET /health` reports process liveness and reaches no dependency, so it stays `200` even when the venue
store is down. `GET /ready` pings the venue store and answers `503` while it is unreachable, which lets an
orchestrator stop routing traffic to a replica that cannot serve requests. Both are unauthenticated.

The probe is bounded: `ReadinessService` gives up after 2 seconds and reports `not_ready`, so a store that
accepts the connection but never answers cannot hold `/ready` open past the orchestrator's own timeout.

---

## 4. Contract

The OpenAPI definition is written by hand in `src/openapi/definition.ts` and exported to `openapi.json`
with `npm run openapi:generate`, without starting the server or opening a browser. There is no interactive
Swagger UI. The generated file is committed and CI regenerates it, failing on any diff, so the published
contract cannot drift away from the implemented routes.