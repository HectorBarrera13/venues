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
- **Identity Attribution**: Secure server-side owner identification extracted from authentication context.

---

## Getting Started

### Prerequisites

- **Node.js**: `v22.14.0` or higher (configured in `.nvmrc`):
  ```bash
  nvm use
  ```
- **npm**: `v10.x` or higher
- **Git**

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

### Running Locally

- **Development mode** (with hot-reload via Nodemon):
  ```bash
  npm run dev
  ```
- **Production mode**:
  ```bash
  npm start
  ```

By default, the server listens on `http://localhost:3000`.

### Local MongoDB and Prisma

This service uses Prisma ORM 6.19.3 for MongoDB. Prisma 7 does not support the MongoDB connector used here. MongoDB must run as a single-node replica set for Prisma relation writes and transactions. The database can run directly on the host; Docker is not required for this setup.

1. Install [MongoDB Community Server](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/) locally and start `mongod` bound to `127.0.0.1:27017` with replica set name `rs0`. On Windows, run:

   ```powershell
   .\scripts\start-mongo.ps1
   ```

   The script accepts an installed `mongod` on `PATH` or the portable MongoDB 8.0.32 binary at `.local/mongodb-win32-x86_64-windows-8.0.32/bin/mongod.exe`. It creates `.local/mongo-data` and keeps MongoDB running in the terminal. In another terminal, initialize the replica set once:

   ```bash
   npm run mongo:init
   ```

2. Copy `.env.example` to `.env` and `.env.test.example` to `.env.test`. These files use separate `venue_db` and `venue_db_test` databases on the local instance. They are ignored by Git. Change the URLs if your local MongoDB uses another address or credentials.

3. Generate the Prisma client and create the collections and indexes:

   ```bash
   npm run db:generate
   npm run db:push
   npm run db:push:test
   ```

4. Check each connection:

   ```bash
   npm run db:check
   npm run db:check:test
   ```

The schema in `prisma/schema.prisma` defines `VenueOwner`, `Venue`, `Zone`, and `Seat`, with references matching the venue-store diagram. IDs are strings to match the existing venue API; `Venue.description` is stored as `desc` in MongoDB. `VenueOwner` holds the owner ID and name for the venue store; authentication remains owned by the Auth service. Prisma relations on MongoDB are managed by Prisma, so write operations should go through the client.

The current venue routes still use the in-memory `VenueRepository`. The Prisma client is available from `src/database/prisma.js` for the subsequent persistence integration.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `nodemon src/server.js` | Starts server with live reloading |
| `npm start` | `node src/server.js` | Starts server in production mode |
| `npm test` | `jest` | Executes the unit test suite |
| `npm run lint` | `eslint .` | Runs static code analysis |
| `npm run build` | `node --check src/server.js src/app.js` | Validates JavaScript syntax integrity |
| `npm run openapi:generate` | `node scripts/generate-openapi.js` | Generates `openapi.json` without starting the server |

---

## API Reference

Run `npm run openapi:generate` to write the OpenAPI definition to `openapi.json`.

Detailed schema definitions, sample request payloads, and response bodies are documented in [docs/api.md](docs/api.md).

---

## Project Structure

```text
venues/
├── .github/workflows/    # CI/CD pipelines (on_pr.yml, release.yml)
├── docs/                 # Detailed architecture and API documentation
├── context/              # Ticket D-Saster domain and product roadmap
├── scripts/              # Versioning (bump.sh) and changelog tooling
├── shared/mocks/         # Shared mock user and role test catalogue
├── src/
│   ├── auth/             # Identity resolution and authentication adapters
│   ├── controllers/      # HTTP request handlers (primary adapters)
│   ├── entities/         # Pure domain entities (Venue)
│   ├── errors/           # Custom error definitions (ApiError)
│   ├── middleware/       # Middlewares (CORS, centralized error handling)
│   ├── repositories/     # Data access abstractions (secondary adapters)
│   ├── routes/           # Express router configuration
│   ├── services/         # Application business logic and use cases
│   ├── app.js            # Express app assembly
│   └── server.js         # HTTP server entrypoint
└── tests/                # Unit and integration test suites
```

---

## Documentation Links

- [Architecture & Design](docs/architecture.md)
- [Detailed API Specification & Contracts](docs/api.md)
- [Mock User & Role Test Catalogue](shared/mocks/README.md)
- [Agent & Developer Operational Guidelines](AGENTS.md)
