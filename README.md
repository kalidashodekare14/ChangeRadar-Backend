# ChangeRadar Backend

Backend API and background worker for **ChangeRadar**, a document change intelligence platform. The system compares versions of a document with a deterministic engine and adds evidence-grounded AI explanations on top.

- **API:** NestJS, REST under `/api/v1`, OpenAPI at `/api/docs` (enabled by `SWAGGER_ENABLED`).
- **Worker:** the same codebase, no HTTP server; extraction, comparison and AI jobs (Phase 6+).
- **Data:** PostgreSQL, Redis, and S3-compatible object storage (RustFS locally).
- **Source of truth:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the phase plan in [`docs/TASKS.md`](docs/TASKS.md).

> **Current status:** Phase 1 application core is implemented and verified locally (config validation, envelopes, error catalog, logging, health, Swagger, Docker/CI). Staging deployment is blocked pending provider/credentials; the Docker image build is unverified because the local Docker daemon was unavailable. Database schema and auth arrive in Phases 2–3. See `docs/TASKS.md` for the roadmap.

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

# 3. Start local infrastructure (PostgreSQL, Redis, RustFS, and optionally API/Worker images)
docker compose up -d

# 4. Run the API (terminal 1)
npm run start:api:dev

# 5. Run the Worker (terminal 2)
npm run start:worker:dev
```

The API listens on `http://localhost:4000`:

| Endpoint                   | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `GET /api/v1/health`       | Liveness (200, no dependency I/O)                |
| `GET /api/v1/health/ready` | PostgreSQL, Redis and storage probes (200 / 503) |
| `GET /api/docs`            | OpenAPI UI when `SWAGGER_ENABLED=true`           |

`docker compose up -d --build` also builds and starts the API (`4000`) and Worker from one image.

Check infrastructure:

```powershell
docker compose ps
docker compose logs storage-init
```

`storage-init` should exit with code `0` after creating the private `changeradar` bucket, applying browser CORS for `http://localhost:3000`, and adding the `uploads/` 1-day lifecycle rule.

## Scripts

| Script                     | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `npm run start:api:dev`    | API in watch mode                                             |
| `npm run start:worker:dev` | Worker in watch mode                                          |
| `npm run build`            | Compile to `dist/`                                            |
| `npm run start:api`        | Run the compiled API                                          |
| `npm run start:worker`     | Run the compiled Worker                                       |
| `npm run lint`             | ESLint                                                        |
| `npm run lint:fix`         | ESLint with fixes                                             |
| `npm run format`           | Prettier write                                                |
| `npm run format:check`     | Prettier check                                                |
| `npm run typecheck`        | TypeScript without emit                                       |
| `npm test`                 | Jest unit/integration tests                                   |
| `npm run test:watch`       | Jest watch mode                                               |
| `npm run test:coverage`    | Jest with coverage                                            |
| `npm run check:circular`   | `madge` circular-import check                                 |
| `npm run check:forbidden`  | CI guard against session-level `SET app.` / `$queryRawUnsafe` |

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
├── config/                 # typed, validated configuration (Zod, fail fast)
├── common/                 # errors, envelopes, logging, middleware, pagination DTOs
├── infrastructure/redis/   # Redis client + throttler storage
└── modules/health/         # liveness and readiness probes
prisma/                     # Phase 2: schema, migrations, seed
scripts/storage/            # RustFS bucket/CORS/lifecycle init
scripts/check-forbidden.js  # CI guard for forbidden SQL patterns
test/                       # unit, e2e, isolation, fixtures
```

## Shared infrastructure conventions

- **Envelopes:** success is `{ success: true, data, meta?, correlationId }`; `meta` appears only on paginated lists (default 20, max 100). Errors use the §10.2 shape with a documented `errorCode` from §30.2.
- **Correlation IDs:** `X-Request-Id` is accepted or generated, echoed as a response header and included in logs and envelopes. The Worker uses the same Pino logger/redaction.
- **Validation:** global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. HTTP DTOs use `class-validator`/`class-transformer`; env, job payloads and AI output use Zod.
- **Security:** `helmet`, cookie parser, and `trust proxy` from `TRUST_PROXY_HOPS` (0 locally; set per platform in staging/production). The API relies on the frontend's same-origin rewrite, so no API CORS is configured.
- **Logging:** structured JSON via `nestjs-pino`; credentials, cookies, tokens, presigned URLs and document text are redacted and never logged.
- **CI order:** lint → format check → typecheck → circular/forbidden checks → unit tests → build → runtime-only `npm audit`. Phase 2 adds migrations and isolation tests.
- **Docker:** one multi-stage image; `node dist/main.js` for the API, `node dist/worker.js` for the Worker. Database migrations are never run at startup.

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
- **App fails to start with an "Invalid environment configuration" error:** `ConfigModule` validates every §17 variable at boot (fail fast). Copy `.env.example` to `.env` and fill missing values; `AI_API_KEY` may be empty with `AI_PROVIDER=fake`.
- **Readiness returns 503:** inspect the `details` object; it names the unavailable dependency (PostgreSQL, Redis or storage). Liveness remains 200 so container orchestrators can distinguish restart from "not ready".

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, schema, API and security.
- [`docs/TASKS.md`](docs/TASKS.md) — phase-by-phase roadmap and current status.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch, commit and verification conventions.
