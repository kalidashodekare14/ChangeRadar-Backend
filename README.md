# ChangeRadar Backend

Backend API and background worker for **ChangeRadar**, a document change intelligence platform. The system compares versions of a document with a deterministic engine and adds evidence-grounded AI explanations on top.

- **API:** NestJS, REST under `/api/v1` (routes start landing in Phase 1).
- **Worker:** the same codebase, no HTTP server; extraction, comparison and AI jobs (Phase 6+).
- **Data:** PostgreSQL, Redis, and S3-compatible object storage (RustFS locally).
- **Source of truth:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the phase plan in [`docs/TASKS.md`](docs/TASKS.md).

> **Current status:** Phase 0 is complete and verified; Phase 1 is next. The API and Worker boot, but there are no business routes, database schema or auth yet. See `docs/TASKS.md` for the roadmap.

## Prerequisites

| Tool           | Version            |
| -------------- | ------------------ |
| Node.js        | 26.13.0 (`.nvmrc`) |
| npm            | 11.20.0            |
| Docker Desktop | with Compose v2/v5 |
| Git            | 2.56+              |

If `docker` is not on `PATH` in an existing PowerShell session, add it:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:Path"
```

## Quick start

```powershell
# 1. Install dependencies (uses the committed lockfile)
npm ci

# 2. Create the local environment file
Copy-Item .env.example .env

# 3. Start local infrastructure (PostgreSQL, Redis, RustFS)
docker compose up -d

# 4. Run the API (terminal 1)
npm run start:api:dev

# 5. Run the Worker (terminal 2)
npm run start:worker:dev
```

The API listens on `http://localhost:4000`. There are no routed endpoints yet, so a request returns `404` — that is expected until Phase 1 adds health and the API prefix.

Check infrastructure:

```powershell
docker compose ps
docker compose logs storage-init
```

`storage-init` should exit with code `0` after creating the private `changeradar` bucket, applying browser CORS for `http://localhost:3000`, and adding the `uploads/` 1-day lifecycle rule.

## Scripts

| Script                     | Purpose                     |
| -------------------------- | --------------------------- |
| `npm run start:api:dev`    | API in watch mode           |
| `npm run start:worker:dev` | Worker in watch mode        |
| `npm run build`            | Compile to `dist/`          |
| `npm run start:api`        | Run the compiled API        |
| `npm run start:worker`     | Run the compiled Worker     |
| `npm run lint`             | ESLint                      |
| `npm run lint:fix`         | ESLint with fixes           |
| `npm run format`           | Prettier write              |
| `npm run format:check`     | Prettier check              |
| `npm run typecheck`        | TypeScript without emit     |
| `npm test`                 | Jest unit/integration tests |
| `npm run test:watch`       | Jest watch mode             |
| `npm run test:coverage`    | Jest with coverage          |

## Ports

| Service                           | Port |
| --------------------------------- | ---- |
| Frontend (separate repository)    | 3000 |
| API                               | 4000 |
| PostgreSQL (host; container 5432) | 5433 |
| Redis                             | 6379 |
| RustFS S3 API                     | 9000 |
| RustFS console                    | 9001 |

## Repository layout

```text
src/
├── main.ts                 # API entry
├── worker.ts               # Worker entry (no HTTP server)
├── app.module.ts
├── worker.module.ts
├── config/                 # Phase 1: typed, validated configuration
├── common/                 # errors, guards, decorators, interceptors, pagination
├── infrastructure/         # database, storage, queue, redis
└── modules/                # auth, users, workspaces, documents, comparisons, …
prisma/                     # Phase 2: schema, migrations, seed
scripts/storage/            # RustFS bucket/CORS/lifecycle init
test/                       # unit bootstrap, e2e, isolation, fixtures
```

## Environment

- `.env.example` documents every variable from ARCHITECTURE §17.
- `.env` is ignored; never commit real secrets.
- `S3_ENDPOINT` is the **server-side** endpoint (`http://localhost:9000` on the host, `http://storage:9000` inside compose).
- `S3_PUBLIC_ENDPOINT` is the **browser-reachable** endpoint used to sign presigned URLs (`http://localhost:9000`).
- Local PostgreSQL bootstrap credentials are `changeradar` / `changeradar`. The runtime (`changeradar_app`) and migrator (`changeradar_migrator`) roles are created in Phase 2.

## API vs Worker

| Process | Command          | Responsibility                                       |
| ------- | ---------------- | ---------------------------------------------------- |
| API     | `dist/main.js`   | HTTP REST API, auth, workspaces, documents, reviews  |
| Worker  | `dist/worker.js` | BullMQ jobs: extraction, comparison, AI, maintenance |

Both use the same modules and configuration; the Worker never opens an HTTP listener. Long-running work goes through BullMQ from Phase 6.

## Local storage (RustFS)

MinIO community images and binaries are no longer publicly distributed, so local development uses [RustFS](https://rustfs.com) 1.0.7, an Apache-2.0 S3-compatible server. The application-facing contract is unchanged: AWS SDK v3 against an S3-compatible endpoint.

- Credentials are local-only defaults (`rustfsadmin` / `rustfsadmin`); change them for anything shared.
- The bucket is private; `storage-init` blocks public access.
- CORS allows `PUT` and `GET` from `APP_URL`, header `Content-Type`, and exposes `ETag`.
- Objects under `uploads/` expire after 1 day.
- RustFS runs as UID/GID `10001:10001`; the compose `storage-permissions` helper prepares named volumes.

Reset local data when needed:

```powershell
docker compose down -v
docker compose up -d
```

## Troubleshooting

- **`docker` not found:** refresh `PATH` as shown above or restart the terminal after installing Docker Desktop.
- **Port already in use:** PostgreSQL is published on host `5433` by default because `5432` is often taken by a local PostgreSQL. Override with `POSTGRES_PORT` in `.env` (also update the database URLs there). Redis/RustFS host ports are fixed in `docker-compose.yml`.
- **Storage permission errors:** the `storage-permissions` helper must run before `storage`; check `docker compose logs storage-permissions`.
- **Worker exits immediately:** it should stay alive until `Ctrl+C`; check the error printed by `npm run start:worker:dev`.
- **`.env` changes ignored:** the app reads environment variables in Phase 1; until then only `PORT` is consumed by the API entry point.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, schema, API and security.
- [`docs/TASKS.md`](docs/TASKS.md) — phase-by-phase roadmap and current status.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch, commit and verification conventions.
