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

   `JWT_SECRET` must hold a long random value shared with the Auth service; it signs and verifies
   partner access tokens (`openssl rand -hex 32`).

4. Generate a development access token:
   ```bash
   npm run token:make -- --role VENUE_OWNER --sub owner-1
   npm run token:make -- --role ORGANIZER --sub organizer-1 --expired
   ```

   Every venue endpoint requires `Authorization: Bearer <token>`. `POST /venues` additionally requires
   the `VENUE_OWNER` role, and the venue owner is always taken from the token `sub` claim. The full
   contract lives in [`src/auth/authConfig.ts`](src/auth/authConfig.ts).

   There is no login endpoint: tokens are minted locally with `token:make` and handed to the
   frontend, which is what [Connecting the Frontend](#connecting-the-frontend-venues-front) covers.

### Running Locally

The backend and MongoDB both run in Docker; see [Running with Docker](#running-with-docker).

By default, the server listens on `http://localhost:3000`.

### Connecting the Frontend (`venues-front`)

The Backstage frontend in `venues-front` runs with Vite **on the host** — it is not containerized —
and reaches this service through the port published by the `api` container (`3000:3000`). Both sides
therefore need to be up for them to talk: this service in Docker, Vite on the host.

There is no login endpoint: tokens are minted here and injected into the frontend environment.

1. Start the stack and create the collections (see [Running with Docker](#running-with-docker)):

   ```bash
   npm run docker:up
   npm run db:push:docker
   ```

2. Mint a token from inside the container, so it is signed with the exact `JWT_SECRET` the API
   loads through `env_file`. It is printed to stdout and lives 1 hour by default:

   ```bash
   docker compose exec api npm run token:make -- --role VENUE_OWNER --sub owner-1
   ```

   Running `npm run token:make ...` on the host yields the same token, since both read the same
   `.env`. Useful flags: `--name "Alex Morgan"` adds a `name` claim, `--expires-in 86400` sets the
   lifetime in seconds, and `--expired` mints an already expired token to check the `401` path.

3. Put the token in the frontend environment, in the `venues-front` checkout:

   ```bash
   cp ../venues-front/.env.example ../venues-front/.env   # first time only
   ```

   ```dotenv
   # venues-front/.env
   VITE_API_BASE_URL = http://localhost:3000
   VITE_DEV_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   `VITE_API_BASE_URL` points at the published container port; `/api` works too through the Vite
   proxy configured in `venues-front/vite.config.js`. This service rejects any venue request that
   does not carry `Authorization: Bearer <token>`, so the frontend client is the piece that injects
   the value.

4. Start the frontend, and restart it whenever the token changes (Vite reads `.env` only at
   startup):

   ```bash
   npm run dev   # in venues-front
   ```

5. Check the token against the container before debugging the UI:

   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:3000/venues
   ```

> Regenerating `JWT_SECRET` in `.env` invalidates the token sitting in the frontend `.env`: requests
> then fail with `401` until you mint a new one and paste it again. `POST /venues` also rejects any
> role other than `VENUE_OWNER`, so mint with `--role VENUE_OWNER` when testing venue registration.

### Running with Docker

This service uses Prisma ORM 6.19.3 for MongoDB. Prisma 7 does not support the MongoDB connector used here, and MongoDB must run as a **single-node replica set** (`rs0`) for Prisma relation writes and transactions. `compose.yaml` provides both services and initializes `rs0` automatically on first boot.

1. Copy the environment template and set a signing secret:

   ```bash
   cp .env.example .env
   ```

   `JWT_SECRET` must hold a long random value shared with the Auth service (`openssl rand -hex 32`).

   > `DATABASE_URL` in `.env` is only used by tools you run **on the host**. The `api` container overrides it to `mongodb://mongo:27017/...`, because inside the compose network Mongo is reachable as `mongo`, not `127.0.0.1`. You do not need to edit it.

2. Build and start both services:

   ```bash
   npm run docker:up
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

5. Mint an access token inside the container and put it in the frontend `.env` to call the venue
   endpoints: [Connecting the Frontend](#connecting-the-frontend-venues-front).

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
| `npm run docker:up` | `docker compose up -d --build` | Builds and starts MongoDB plus the API with hot reload |
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
| `npm run token:make` | `tsx scripts/make-token.ts` | Mints a development access token (`--role`, `--sub`, `--expires-in`, `--expired`); same helper as `docker compose exec api npm run token:make` and `./scripts/make-token` |
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
