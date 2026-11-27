<div align="center">

# Ticket D-Saster - Venues Microservice (`venue-service`)

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Tested with Jest](https://img.shields.io/badge/Tested_with-Jest-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![Code Style ESLint](https://img.shields.io/badge/Code_Style-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?style=flat-square&logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![Team](https://img.shields.io/badge/Team-SubAgentes-purple)](./AGENTS.md)

Authoritative backend service for physical venue catalogue management, spatial metadata, and seating capacities within the distributed **Ticket D-Saster** platform.

Developed and maintained by **Team SubAgentes**.

</div>

---

## Features

- **Authoritative Venue Catalogue**: Central source of truth for physical venues, locations, and seating configurations.
- **Identity Attribution**: Secure server-side owner identification extracted from the verified access token.

---

## Getting Started

### Prerequisites

- **Node.js**: `v22.14.0` or higher (configured in `.nvmrc`):
   ```bash
   nvm use
   ```
- **npm**: `v10.x` or higher
- **Git**
- **Docker** with Compose v2 — required to run the backend and MongoDB locally.
  No separate MongoDB installation is needed; the database runs in a container.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/HectorBarrera13/venues.git
   cd venues
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```

   Generate a local signing secret:
   ```bash
   openssl rand -hex 32
   ```
   Replace the `JWT_SECRET` placeholder in `.env` with the generated value. The API verifies
   tokens with this value and the local token generator uses it to sign test tokens. In a deployed
   environment, it must match the Auth service's signing secret.

4. Generate a development token for a venue owner:
   ```bash
   npm run --silent token:make -- --role VENUE_OWNER --sub owner-1
   ```

   The command prints a signed JWT that is valid for one hour. Use it as the bearer token when
   calling the API. To generate tokens for authorization checks, use an organizer or an expired
   venue-owner token:
   ```bash
   npm run token:make -- --role ORGANIZER --sub organizer-1
   npm run token:make -- --role VENUE_OWNER --sub owner-1 --expired
   ```

   Every venue endpoint requires `Authorization: Bearer <token>`. `POST /venues` additionally requires
   the `VENUE_OWNER` role, and the venue owner is always taken from the token `sub` claim. The full
   contract lives in [`src/auth/authConfig.ts`](src/auth/authConfig.ts).

### Running Locally

The backend and MongoDB both run in Docker; see [Running with Docker](#running-with-docker).

By default, the server listens on `http://localhost:3000`.

### Running with Docker

This service uses Prisma ORM 6.19.3 for MongoDB. Prisma 7 does not support the MongoDB connector used here, and MongoDB must run as a **single-node replica set** (`rs0`) for Prisma relation writes and transactions. `compose.yaml` provides both services and initializes `rs0` automatically on first boot.

1. Copy the environment template and set a signing secret:

   ```bash
   cp .env.example .env
   ```

   Set `JWT_SECRET` in `.env` as described above; the API and local token generator must use the same
   value. In a deployed environment, it must match the Auth service's signing secret.

   > `DATABASE_URL` in `.env` is only used by tools you run **on the host**. The `api` container overrides it to `mongodb://mongo:27017/...`, because inside the compose network Mongo is reachable as `mongo`, not `127.0.0.1`. You do not need to edit it.

2. Build and start both services in the background:

   ```bash
   docker compose up -d --build
   ```

   The `api` container bind-mounts the working directory and runs `tsx watch`, so editing files on the host reloads the server automatically.

   > When host port `3000` is already taken by another app, set `VENUES_API_PORT` in `.env`
   > (for example `3100`) instead of stopping that app; the container keeps listening on `3000`
   > internally. Point the Backstage at the same port with `VENUES_API_ORIGIN`.

3. Create the collections and indexes once:

   ```bash
   npm run db:push:docker
   ```

   > `compose.yaml` keeps `node_modules` in an anonymous volume, so after changing
   > `prisma/schema.prisma` the container can still hold the previously generated client and
   > queries fail with an unknown-field error. Regenerate it in place with
   > `npm run db:generate:docker` (`--build` alone does not, because the dependency layer is cached).

4. Follow the logs:

   ```bash
   npm run docker:logs
   ```

5. Verify that transactions work (one commit and one forced rollback against `rs0`):

   ```bash
   npm run db:verify-tx:docker
   ```

   The seat-map save (`POST /venues/{id}/map`) writes the new version and moves `latestMapVersion` in a single Prisma `$transaction`; MongoDB only supports that on a replica set, so this check must print `Commit: ok` and `Rollback: ok`.

Common lifecycle commands:

| Command | Description |
|---|---|
| `npm run docker:up` | Build and start MongoDB plus the API |
| `npm run docker:logs` | Stream API logs |
| `npm run db:generate:docker` | Regenerate the Prisma client inside the `api` container after a schema change |
| `npm run docker:down` | Stop and remove both containers |
| `docker compose down -v` | Stop and **also delete the database volume** |

Database data lives in the named Docker volume `venue-mongo-data`, so it survives restarts and `docker compose down`. Removing `.env` is not required; the container reads it through `env_file`.

### MongoDB and Prisma without Docker

The Prisma client and schema are usable against any MongoDB replica set, provided `DATABASE_URL` points at it:

```bash
npm run db:generate
npm run db:push
npm run db:check
```

The schema in `prisma/schema.prisma` defines `VenueOwner`, `Venue` and `MapVersion`:

- `Venue` has a real geographic identity: `address`, `city`, `country` (ISO alpha-2), `location` stored as a GeoJSON Point (WGS84, `[lng, lat]`), optional geocoder references (`externalId`, `externalSource`, `osmRef`), a search key `nameNormalized`, and `latestMapVersion` (`0` until a map is saved).
- `MapVersion` is an immutable seat-map snapshot per version (`stage`, `zones`, `seats` as JSON, see [`docs/map-format.md`](docs/map-format.md)), unique on `venueId + version`.
- `VenueOwner` holds the owner ID and name; authentication remains owned by the Auth service.

`npm run db:push` runs `prisma db push` and then `npm run db:indexes`, which creates the two indexes the Prisma MongoDB connector cannot declare: a `2dsphere` index on `venues.location` and a unique **partial** index on `venues.osmRef` (only string values take part, so venues without an OpenStreetMap reference never collide). Both steps are idempotent.

The venue routes now use `VenueRepository.ts`, which stores records through Prisma. `POST /venues` creates a venue and its owner record when needed (`409` on a duplicate `osmRef`); `GET /venues` reads persisted venues as `{ data, pagination }`; `GET /venues/{id}` reads one venue or answers `404`. Both `/api/venues` aliases use the same repository. Data remains in MongoDB after the API process restarts.

### Database addresses

| Context | `DATABASE_URL` host | Notes |
|---|---|---|
| Inside the `api` container | `mongo:27017` | Service name on the compose network; set by `compose.yaml` |
| On the host (Prisma CLI, editors) | `127.0.0.1:27017` | Published by the `mongo` service; comes from `.env` |

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run docker:up` | `docker compose up -d --build` | Alias that builds and starts MongoDB plus the API with hot reload |
| `npm run docker:down` | `docker compose down` | Stops and removes the containers |
| `npm run docker:logs` | `docker compose logs -f api` | Streams API container logs |
| `npm run db:push:docker` | `docker compose exec api npm run db:push` | Creates collections and indexes in the containerized MongoDB |
| `npm run db:check:docker` | `docker compose exec api npm run db:check` | Pings MongoDB from inside the container |
| `npm run db:verify-tx:docker` | `docker compose exec api npm run db:verify-tx` | Runs the transaction commit/rollback check inside the container |
| `npm run dev` | `tsx watch src/server.ts` | Starts the server directly on the host (see Docker notes above) |
| `npm start` | `npm run build && node dist/src/server.js` | Compiles and starts the server |
| `npm test` | `jest` | Executes the unit test suite |
| `npm run test:integration` | `jest --config jest.integration.config.cjs --runInBand` | Integration and e2e suites on a real MongoDB replica set (see below) |
| `npm run lint` | `eslint .` | Runs static code analysis |
| `npm run build` | `tsc -p tsconfig.json && tsc -p tsconfig.tests.json` | Compiles the service and checks TypeScript tests |
| `npm run db:generate` | `prisma generate` | Generates the Prisma client from `prisma/schema.prisma` |
| `npm run db:push` | `prisma db push && npm run db:indexes` | Syncs collections and Prisma indexes, then creates the raw MongoDB indexes |
| `npm run db:indexes` | `tsx scripts/ensure-indexes.ts` | Creates the `2dsphere` (`location`) and partial unique (`osmRef`) indexes |
| `npm run db:check` | `tsx scripts/check-database.ts` | Pings MongoDB using `DATABASE_URL` from `.env` |
| `npm run db:verify-tx` | `tsx scripts/verify-transaction.ts` | Commits one transaction and rolls another back; fails unless MongoDB is a working replica set |
| `npm run openapi:generate` | `tsx scripts/generate-openapi.ts` | Generates `openapi.json` without starting the server |
| `npm run token:make` | `tsx scripts/make-token.ts` | Mints a development access token (`scripts/make-token`) |

### Integration tests

`npm run test:integration` runs `tests/integration/**` against the real app, the real Prisma client and a MongoDB **replica set**:

- With `INTEGRATION_DATABASE_URL` set (CI, or your `docker compose` Mongo), it uses that database.
- Without it, it boots a throw-away single-node replica set with `mongodb-memory-server` (the first run downloads a `mongod` binary), so no Docker is needed.

In both cases the schema and raw indexes are applied with `npm run db:push` first. CI runs this suite in the `integration` job of `on_pr.yml` against `mongo:7.0` started with `--replSet rs0`, the same image as `compose.yaml`.

---

## API Reference

Run `npm run openapi:generate` to write the OpenAPI definition to `openapi.json`. The file is committed, and CI fails if regenerating it produces a diff, so the contract and the code cannot drift apart.

There is no interactive Swagger UI: the OpenAPI definition is generated headlessly from
[`src/openapi/definition.ts`](src/openapi/definition.ts) and served as the static `openapi.json`.

Detailed schema definitions, sample request payloads, and response bodies are documented in [docs/api.md](docs/api.md).

---

## Project Structure

```text
venues/
├── .github/workflows/    # CI/CD pipelines (on_pr.yml, release.yml)
├── compose.yaml          # Local stack: MongoDB (rs0) + API with hot reload
├── Dockerfile            # Image definitions: deps, dev (hot reload), prod
├── docs/                 # Detailed architecture and API documentation
├── context/              # Ticket D-Saster domain and product roadmap
├── scripts/              # Versioning (bump.sh), changelog and make-token tooling
├── src/
│   ├── auth/             # JWT contract, verifier and identity resolution
│   ├── controllers/      # HTTP request handlers (primary adapters)
│   ├── entities/         # Pure domain entities (Venue)
│   ├── errors/           # Custom error definitions (ApiError)
│   ├── middleware/       # Middlewares (auth, role guard, CORS, error handling, 404)
│   ├── openapi/          # OpenAPI definition exported to openapi.json
│   ├── repositories/     # Data access abstractions (secondary adapters)
│   ├── routes/           # Express router configuration
│   ├── services/         # Application business logic and use cases
│   ├── app.ts            # Express app assembly
│   └── server.ts         # HTTP server entrypoint
└── tests/                # Unit and integration test suites
```

---

## Documentation Links

- [Architecture & Design](docs/architecture.md)
- [Detailed API Specification & Contracts](docs/api.md)
- [Agent & Developer Operational Guidelines](AGENTS.md)
