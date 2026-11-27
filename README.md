# ChangeRadar Backend

Backend API and background worker for **ChangeRadar**, a document change intelligence platform. The system compares versions of a document with a deterministic engine and adds evidence-grounded AI explanations on top.

- **API:** NestJS, REST under `/api/v1`, OpenAPI at `/api/docs` (enabled by `SWAGGER_ENABLED`).
- **Worker:** the same codebase, no HTTP server; extraction, comparison and AI jobs (Phase 6+).
- **Data:** PostgreSQL, Redis, and S3-compatible object storage (RustFS locally).
- **Source of truth:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the phase plan in [`docs/TASKS.md`](docs/TASKS.md).

> **Current status:** Phases 1–3 are implemented and verified locally. Phase 2 adds the 15-table MVP schema, migrator/runtime roles, forced RLS and the isolation suite; Phase 3 adds cookie-based authentication, sessions and CSRF. Staging deployment remains blocked pending provider/credentials. See `docs/TASKS.md` for the roadmap.

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

### Authentication (Phase 3)

Auth uses first-party HttpOnly cookies. Every state-changing request (`POST`/`PUT`/`PATCH`/`DELETE`) — **including login, register and refresh** — must send `X-CSRF-Token` matching the `cr_csrf` cookie. When the cookie is absent, bootstrap it first:

```text
GET  /api/v1/auth/csrf          -> { csrfToken }  (sets cr_csrf)
POST /api/v1/auth/register      { name, email, password }
POST /api/v1/auth/login         { email, password }
POST /api/v1/auth/refresh       (rotates cr_refresh; new cr_access)
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId
POST /api/v1/auth/sessions/revoke-others
PATCH /api/v1/users/me          { name }
POST /api/v1/users/me/password  { currentPassword, newPassword }
```

Cookie rules (§9.1): `cr_access` (`Path=/`, HttpOnly, outlives the 15-minute JWT for the whole session), `cr_refresh` (`Path=/api/v1/auth`, HttpOnly) and `cr_csrf` (`Path=/`, readable by JS, 30 days). All use `SameSite=Lax`, `Secure` in production and no `Domain`. On register/login/refresh the CSRF cookie rotates — read the new value from `document.cookie`. Logout and `INVALID_REFRESH_TOKEN` / `SESSION_REVOKED` clear all three cookies. An expired-but-signed JWT returns `401 TOKEN_EXPIRED` (then refresh); a missing/invalid one returns `401 UNAUTHENTICATED`, a revoked session `401 SESSION_REVOKED`.

Global guard order is `ThrottlerGuard` → `CsrfGuard` → `AuthGuard`; `@Public()` bypasses only `AuthGuard`. Login/register/refresh are limited to 5/3/30 requests per minute per IP using the Redis throttler. The dev seed user `dev@example.com` logs in with `ChangerRadar-dev-only` (development only — never used in staging/production).

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
├── infrastructure/database/ # PrismaService, TenantDb, tenant repository base
├── infrastructure/redis/   # Redis client + throttler storage
├── setup-app.ts            # shared HTTP bootstrap (main.ts + E2E tests)
├── modules/auth/           # identity, sessions, tokens, cookies, guards, CSRF
├── modules/users/          # profile + password change
└── modules/health/         # liveness and readiness probes
prisma/schema.prisma        # 15 MVP tables + 14 MVP enums
prisma/migrations/          # generated Prisma migration
prisma/manual/              # helper functions, RLS, CHECKs, grants
prisma/seed.ts              # idempotent development seed
prisma7.config.ts           # Prisma CLI config (migrator URL)
scripts/db/                 # role creation + manual SQL runner
scripts/storage/            # RustFS bucket/CORS/lifecycle init
scripts/check-forbidden.js  # CI guard for forbidden SQL patterns
test/                       # unit, e2e, isolation, fixtures
```

## Shared infrastructure conventions

- **Envelopes:** success is `{ success: true, data, meta?, correlationId }`; `meta` appears only on paginated lists (default 20, max 100). Errors use the §10.2 shape with a documented `errorCode` from §30.2.
- **Correlation IDs:** `X-Request-Id` is accepted or generated, echoed as a response header and included in logs and envelopes. The Worker uses the same Pino logger/redaction.
- **Validation:** global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. HTTP DTOs use `class-validator`/`class-transformer`; env, job payloads and AI output use Zod.
- **Security:** `helmet`, cookie parser, and `trust proxy` from `TRUST_PROXY_HOPS` (0 locally; set per platform in staging/production). The API relies on the frontend's same-origin rewrite, so no API CORS is configured.
- **Auth pipeline:** global `ThrottlerGuard` → `CsrfGuard` → `AuthGuard`; only `@Public()` routes skip authentication, never CSRF. `users`/`sessions` are global tables (PrismaService), all tenant rows stay behind `TenantDb.run()`.
- **Logging:** structured JSON via `nestjs-pino`; credentials, cookies, tokens, presigned URLs and document text are redacted and never logged.
- **CI order:** lint → format check → typecheck → circular/forbidden checks → unit tests → build → runtime-only `npm audit`, plus a database job: roles → migrations on an empty DB → manual SQL → isolation tests → build.
- **Docker:** one multi-stage image; `node dist/main.js` for the API, `node dist/worker.js` for the Worker. Database migrations are never run at startup.

## Environment

- `.env.example` documents every variable from ARCHITECTURE §17.
- `.env` is ignored; never commit real secrets.
- `S3_ENDPOINT` is the **server-side** endpoint (`http://localhost:9000` on the host, `http://storage:9000` inside compose).
- `S3_PUBLIC_ENDPOINT` is the **browser-reachable** endpoint used to sign presigned URLs (`http://localhost:9000`).
- Local PostgreSQL bootstrap credentials are `changeradar` / `changeradar`. `npm run db:roles` creates `changeradar_migrator` (DDL) and `changeradar_app` (`NOSUPERUSER NOBYPASSRLS`, DML only) from `BOOTSTRAP_DATABASE_URL` / `MIGRATOR_PASSWORD` / `APP_PASSWORD`.
- `DATABASE_URL` is the runtime app-role URL used by the API/Worker through the `PrismaPg` adapter; `DIRECT_DATABASE_URL` is the migrator URL used only by the Prisma CLI.

## Database and tenant isolation

The workspace is the tenant. Tenant tables are reachable only through `TenantDb.run()`, which sets `app.current_workspace_id`, `app.current_user_id` and `app.invitation_token_hash` with transaction-local `set_config(..., true)`. Every tenant table has `ENABLE` + `FORCE ROW LEVEL SECURITY`; missing context fails closed. `users`/`sessions` are global exceptions. No superuser or `BYPASSRLS` role exists at runtime.

Local bootstrap order (after `docker compose up -d postgres`):

```powershell
npm ci
npm run db:generate                 # Prisma 7 client -> src/generated/prisma (git-ignored)
npm run db:roles                    # creates migrator + runtime roles (bootstrap URL)
npm run db:migrate:deploy           # tables, relations, constraints, indexes
npm run db:manual                   # helpers, RLS, CHECKs, grants (idempotent)
npm run db:seed                     # two users/workspaces + sample data (idempotent)
```

- `npm run db:migrate` is for schema changes in development; `npm run db:reset` recreates the local database (dev only). Never run migrations from the API/Worker.
- `npm run check:forbidden` fails on session-level `SET app.`, unsafe raw SQL, `set_config` outside `TenantDb`, and direct generated-client imports outside the database/error layer.
- Isolation tests: `RUN_DB_TESTS=true npm test -- --runInBand test/isolation`. They seed fixtures as the migrator role and run all assertions as `changeradar_app`. Cases 1–4 and 9–14 of ARCHITECTURE §20 run in this phase; cases 5–8 are added with their features.
- Release/rollback: roles → `migrate deploy` → manual SQL → grants → app deploy. Roll back by redeploying the previous image; migrations follow expand → migrate → contract. Deferred features are additive only.
- Auth E2E (`test/e2e/auth.e2e.spec.ts`) runs against the same migrated database and Redis when `RUN_DB_TESTS=true`; locally it reads DB URLs from `.env` (CI injects its own). Run it with `$env:RUN_DB_TESTS='true'; npm test -- --runInBand auth.e2e.spec`.

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
