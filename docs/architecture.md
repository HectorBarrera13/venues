# Architecture & Domain Design

This document details the architectural principles, container boundaries, and domain model of the `venue-service`.

---

## 1. Domain Overview

The `venue-service` is the authoritative component for the **Venues Domain** within the Ticket D-Saster platform:
- Maintains physical venue configurations, locations, and metadata.
- Serves as the catalogue consumed by `event-service` (Team Aura) and `search-service` (Team Error200).
- Integrates with the partner administration portal (`Backstage`) for Venue Owners.

---

## 2. Layer Responsibilities

- **Domain Core (`src/entities/`)**:
  Contains the pure `Venue` entity. Holds domain invariants, fields (`id`, `name`, `description`, `location`, `ownerId`, `createdAt`), and serialization helpers without any framework dependencies.

- **Application Services (`src/services/`)**:
  Encapsulates use cases (`VenueService`). Enforces validation rules, coordinates persistence via repository interfaces, and resolves owner identity from the authenticated security context.

- **Primary / Driving Adapters (`src/controllers/`, `src/routes/`)**:
  HTTP REST controllers and routing handlers. Maps inbound HTTP requests to application services and formats outbound JSON responses and status codes.

- **Secondary / Driven Adapters (`src/repositories/`, `src/auth/`)**:
  Persistence implementations (`VenueRepository`) and identity providers (`CurrentUserProvider`). Adapters can be replaced or mocked during unit testing without touching business logic.
