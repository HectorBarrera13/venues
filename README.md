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
- **Hexagonal Architecture**: Business domain logic cleanly decoupled from transport layers, databases, and frameworks.
- **Identity Attribution**: Secure server-side owner identification extracted from authentication context.
- **Role-Based Access Control**: Granular endpoint protection ensuring mutating operations are restricted to Venue Owners.
- **Gateway & Cloud-Native Ready**: Prepared for reverse-proxy routing under `/venues` with automatic prefix stripping.

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

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `nodemon src/server.js` | Starts server with live reloading |
| `npm start` | `node src/server.js` | Starts server in production mode |
| `npm test` | `jest` | Executes the unit test suite |
| `npm run lint` | `eslint .` | Runs static code analysis |
| `npm run build` | `node --check src/server.js src/app.js` | Validates JavaScript syntax integrity |

---

## API Reference

Interactive API documentation (Swagger UI) is available at `/api-docs` when running the application.

Detailed schema definitions, sample request payloads, and response bodies are documented in [docs/api.md](docs/api.md).

### Primary Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Service liveness health check | No |
| `GET` | `/venues` | List all registered venues | No |
| `POST` | `/venues` | Register a new physical venue | Yes (`role: venue_owner`) |

> Note: All `/venues` routes are also accessible via `/api/venues` for backward compatibility. During local development, the `x-mock-user` header can be used to simulate authenticated profiles.

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

- [Architecture & Hexagonal Design](docs/architecture.md)
- [Detailed API Specification & Contracts](docs/api.md)
- [Mock User & Role Test Catalogue](shared/mocks/README.md)
- [Agent & Developer Operational Guidelines](AGENTS.md)
- [Platform Roadmap & Current MVP](context/product/now.md)

---

## Contributing & Git Workflow

1. Branch naming format:
   ```bash
   git checkout -b feature/<TICKET-ID>-<short-description>
   ```

2. Commits must follow **Conventional Commits** ending with the ticket ID in parentheses:
   ```text
   <type>(<optional-scope>): <summary in imperative mood> (<TICKET-ID>)
   ```

   *Examples:*
   - `feat(venues): add owner attribution from auth context (VE-02)`
   - `test(controllers): assert 403 response for unauthorized role (PA-09)`
