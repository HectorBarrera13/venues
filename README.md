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

3. Create the collections and indexes once:

   ```bash
   npm run db:push:docker
   ```

4. Follow the logs:

   ```bash
   npm run docker:logs
   ```

Common lifecycle commands:

| Command | Description |
|---|---|
| `npm run docker:up` | Build and start MongoDB plus the API |
| `npm run docker:logs` | Stream API logs |
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

The schema in `prisma/schema.prisma` defines `VenueOwner`, `Venue`, `Zone`, and `Seat`, with references matching the venue-store diagram. IDs are strings to match the existing venue API; `Venue.description` is stored as `desc` in MongoDB. `VenueOwner` holds the owner ID and name for the venue store; authentication remains owned by the Auth service. Prisma relations on MongoDB are managed by Prisma, so write operations should go through the client.

The venue routes now use `VenueRepository.ts`, which stores records through Prisma. `POST /venues` creates a venue and its owner record when needed; `GET /venues` reads persisted venues; `GET /venues/{id}` reads one venue or answers `404`. Both `/api/venues` aliases use the same repository. Data remains in MongoDB after the API process restarts.

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
| `npm run dev` | `tsx watch src/server.ts` | Starts the server directly on the host (see Docker notes above) |
| `npm start` | `npm run build && node dist/src/server.js` | Compiles and starts the server |
| `npm test` | `jest` | Executes the unit test suite |
| `npm run lint` | `eslint .` | Runs static code analysis |
| `npm run build` | `tsc -p tsconfig.json && tsc -p tsconfig.tests.json` | Compiles the service and checks TypeScript tests |
| `npm run db:generate` | `prisma generate` | Generates the Prisma client from `prisma/schema.prisma` |
| `npm run db:check` | `tsx scripts/check-database.ts` | Pings MongoDB using `DATABASE_URL` from `.env` |
| `npm run openapi:generate` | `tsx scripts/generate-openapi.ts` | Generates `openapi.json` without starting the server |
| `npm run token:make` | `tsx scripts/make-token.ts` | Mints a development access token (`scripts/make-token`) |
| `npm run mocks:verify` | `tsx shared/mocks/verify.ts` | Validates the shared mock user catalogue |

---

## API Reference

Run `npm run openapi:generate` to write the OpenAPI definition to `openapi.json`.

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
├── shared/mocks/         # Shared mock user and role test catalogue
├── src/
│   ├── auth/             # JWT contract, verifier and identity resolution
│   ├── controllers/      # HTTP request handlers (primary adapters)
│   ├── entities/         # Pure domain entities (Venue)
│   ├── errors/           # Custom error definitions (ApiError)
│   ├── middleware/       # Middlewares (auth, role guard, CORS, error handling)
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
- [Mock User & Role Test Catalogue](shared/mocks/README.md)
- [Agent & Developer Operational Guidelines](AGENTS.md)
