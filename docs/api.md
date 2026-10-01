# API Reference & Contracts

The OpenAPI 3.0 definition is generated from `src/openapi/definition.js`:

```bash
npm run openapi:generate
```

This writes `openapi.json` in the repository root. The command does not start the server or require Swagger UI. Both `/venues` and `/api/venues` expose the same operations.

## Current authentication behavior

The current routes have no authentication or role-check middleware. `POST /venues` does not read `x-mock-user` or a bearer token. The service uses `ownerId` from the request body when provided, or defaults to `venue-owner-1`. The `CurrentUserProvider` exists but is not connected to the routes.

## GET /venues

Returns the registered venues as a JSON array with HTTP 200. Each venue contains `id`, `name`, `description`, `location`, `ownerId`, and `createdAt`. The route is also available at `GET /api/venues`.

## POST /venues

Creates a venue and returns it with HTTP 201. The route is also available at `POST /api/venues`.

Request body:

```json
{
  "name": "Estadio Azteca",
  "description": "Multi-purpose stadium",
  "location": "Coyoacan, CDMX"
}
```

`name`, `description`, and `location` are required nonempty strings. The current implementation also accepts an optional `ownerId`.

If a required field is missing or empty, the service responds with HTTP 400 and an error body such as:

```json
{ "error": "Field \"name\" is required" }
```

Unexpected errors use HTTP 500 with the same `{ "error": "..." }` body shape.
