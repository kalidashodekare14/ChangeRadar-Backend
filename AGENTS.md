# AGENTS.md

## Repository state

- **Phases 0–3 core are complete and verified locally.** Phase 0 scaffold, Phase 1 shared infrastructure, Phase 2's 15-table Prisma schema/migrator roles/forced RLS/`TenantDb`/seed/isolation suite, and Phase 3's cookie auth, sessions, CSRF, guards, profile/password change and auth E2E suite all exist and pass locally.
- Staging deployment remains `[!]` blocked (no provider/credentials). The Docker image build and compose API/Worker startup were verified on 2026-11-27 (health/readiness green). Business logic, queues and storage adapter start in Phase 4+.
- Commands that work now: `npm ci`, `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npm run typecheck`, `npm run check:circular`, `npm run check:forbidden`, `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run build`, `npm run start:api`, `npm run start:worker`, `npm run start:api:dev`, `npm run start:worker:dev`, `npx prisma -v`, `docker compose config/up/down`, plus `npm run db:generate`, `npm run db:roles`, `npm run db:migrate:deploy`, `npm run db:manual`, `npm run db:seed`, `npm run db:reset`, `npm run db:migrate:status`. Isolation tests: `RUN_DB_TESTS=true npm test -- --runInBand test/isolation`; auth E2E: `RUN_DB_TESTS=true npm test -- --runInBand auth.e2e.spec` (setup-env loads DB URLs from `.env` for DB-backed runs).
- Toolchain pins: Node `26.13.0`, npm `11.20.0`, NestJS `12.6.3`, TypeScript `6.0.3`, Prisma `7.10.1`, Jest `30.5.2`. Phase 1 adds `@nestjs/config@12.1.1`, `@nestjs/swagger@12.1.3`, `@nestjs/throttler@6.8.0`, `helmet@8.3.0`, `cookie-parser@1.4.7`, `nestjs-pino@5.3.2`, `pino@10.4.0`, `pino-http@11.0.0`, `ioredis@6.1.0`, `pg@8.23.1`, `zod@4.6.7`, `class-validator@0.15.1`, `class-transformer@0.5.1`, and dev-only `madge@8.0.0`, `@types/cookie-parser@1.4.10`, `@types/pg@8.23.1`. Phase 2 adds exact-pinned `dotenv@17.4.2` (config-file env loading) and `tsx@4.23.15` (seed + DB scripts). Phase 3 adds `argon2@0.45.2` (verifies the Phase 2 seed PHC hash; m=65536,t=3,p=4), `jsonwebtoken@9.0.3` and dev-only `@types/jsonwebtoken@9.0.10`. Nest packages are ESM-only; the source stays CommonJS via `module: nodenext` + Node `require(esm)`, and Jest scripts pass `--experimental-vm-modules`. Prisma's generator uses `moduleFormat = "cjs"` and `previewFeatures = ["partialIndexes"]`; the generated `.ts` client imports sibling `.js` paths, so Jest uses a `moduleNameMapper` to strip `.js` from relative imports and `check:circular` excludes `generated`. Prisma 7 auto-discovers `prisma7.config.ts` (legacy `prisma.config.ts` is only a fallback); its datasource config exposes `url`/`shadowDatabaseUrl` only, with the migrator URL from `DIRECT_DATABASE_URL`. `madge@8` declares TypeScript `^5.x`; a scoped `overrides` entry maps its peer to the pinned TypeScript 6 so `npm ci` stays reproducible.
- Local infrastructure: Postgres container port `5432` is published on host `5433` (`POSTGRES_PORT`) because 5432 is occupied locally; Redis `6379`; RustFS `9000`/`9001`. Compose infrastructure is verified healthy and `storage-init` exits 0.
- Install scripts for `prisma` and `@prisma/engines` are approved in the lockfile; `@parcel/watcher` and `@scarf/scarf` are denied (prebuilt binaries work). Phase 2's `tsx` pulls `esbuild@0.28.2`, whose postinstall is also unapproved but works through its prebuilt binary (`npx tsx --version` verified). Phase 3 approves `argon2@0.45.2`'s install script after verifying its native binary under Node 26. Keep `npm ci` reproducible; do not commit `.env`.
- HTTP conventions implemented in Phase 1: `/api/v1` prefix, `/api/docs` gated by `SWAGGER_ENABLED`, success/error envelopes with correlation IDs, global `ValidationPipe`, §30.2 error catalog, `nestjs-pino` redaction, `helmet`, cookie parser, `TRUST_PROXY_HOPS`, Redis throttler. Health endpoints skip throttling so liveness works without Redis.
- Phase 2 conventions: `TenantDb.run()` is the sole tenant access path (transaction-local `set_config(..., true)`); all 13 tenant tables have `FORCE RLS`; runtime role is `NOSUPERUSER NOBYPASSRLS` with column-level UPDATE only on `document_versions`; comparison output tables (`comparison_changes`, `change_evidence`, `ai_insights`) are insert-only. `prisma migrate deploy` and manual SQL run in an explicit release step, never at app startup. CI has a separate database job (roles → migrations → manual SQL → isolation tests).
- Phase 3 conventions: backend-managed HttpOnly cookies (`cr_access`, `cr_refresh`, `cr_csrf`) with exact §9.1 attributes; `cr_access` outlives its 15-minute JWT so `TOKEN_EXPIRED` is observable; refresh rotation is an atomic conditional hash replacement; `AuthGuard` (global, `@Public()` opt-out) → session revocation + `is_active` check; `CsrfGuard` has no exemptions; guard order Throttler → CSRF → Auth. `users`/`sessions` are global tables; registration creates the user + personal workspace + OWNER membership in one transaction via `TenantDb.runInTransaction`. `src/setup-app.ts` is shared by `main.ts` and E2E tests. Jest relaxes `no-unsafe-*`/`unbound-method` for `test/**` only.
- The current phase is **Phase 4** (`docs/TASKS.md`) — workspace, membership and authorization. Phases 0–3 core are done; staging deployment remains `[!]` blocked.

## Source of truth

- `docs/ARCHITECTURE.md` (v2.1) is authoritative for design, schema, API, and security. `docs/TASKS.md` is the phase-by-phase roadmap.
- If design changes, update `ARCHITECTURE.md` **first**, then `TASKS.md` (stated in TASKS §1).
- Cross-references in TASKS say `backend/ARCHITECTURE.md`; the actual paths are `docs/ARCHITECTURE.md` and `docs/TASKS.md`. Frontend companion docs referenced by ARCHITECTURE are not in this repo.
- Mark a task `[x]` only after it is implemented **and** verified. Status legend: `[ ]` todo, `[x]` verified, `[!]` blocked with reason, `[-]` deferred.

## Workflow constraints

- Work phases **0–12 in order**, one phase at a time. Never skip Phase 2 (database + tenant isolation) or Phase 3 (authentication).
- The MVP is a fixed subset: **15 tables**, listed modules only. Part F of ARCHITECTURE and Part 2 of TASKS are **deferred — do not implement unless explicitly asked**. Deferred work must be additive only.
- Two runtime processes from one codebase: API (`src/main.ts`) and Worker (`src/worker.ts`, no HTTP server). One Dockerfile, two commands.
- Target CI order (per ARCHITECTURE §21): lint → typecheck → unit → migrations on an empty DB → integration + isolation → build. Add the `madge` circular-dependency check from TASKS Phase 1.

## Non-negotiable invariants

**Tenant isolation (workspace = tenant)**

- All tenant-table access goes through `TenantDb.run()`, which sets `app.current_workspace_id` / `app.current_user_id` with transaction-local `set_config(..., true)`.
- Forbidden: session-level `SET`, `$queryRawUnsafe`, external calls (storage/AI) inside a tenant transaction. CI is meant to enforce the first two.
- Never trust a client-supplied workspace ID. Workspace comes from the URL `:workspaceId`, then `WorkspaceGuard` validates membership. Non-members get **404**, not 403.
- RLS: `ENABLE` + `FORCE` on every tenant table; missing context must return zero rows. Runtime role is `NOSUPERUSER NOBYPASSRLS`; DDL runs only through the migrator role in a release step, never at app startup.
- Migrations are Prisma Migrate for tables/relations plus **manual SQL** for RLS policies, helper functions, CHECK constraints, and grants.

**Deterministic engine**

- `src/modules/comparisons/engine/` is pure TypeScript: no NestJS, Prisma, I/O, clock, or randomness. Stable ordering.
- AI must never modify comparison results, and comparison must work with AI disabled/failing.
- Any engine behavior change requires an `ENGINE_VERSION` bump plus fixture snapshot updates.

**AI**

- Provider-agnostic adapter; `FakeAiProvider` must support tests, CI, and keyless local runs.
- Validate provider output with Zod and drop insights whose evidence IDs do not belong to the run.
- Never log prompts, responses, document text, extracted text, tokens, cookies, or presigned URLs.

**Uploads / storage**

- Upload completion order is fixed: verify token → idempotency lookup by `upload_token_id` (`jti`) → HEAD temp object → checksum/signature → duplicate check → copy → transaction. The idempotency lookup must happen before any storage call.
- Presigned URLs are signed for `S3_PUBLIC_ENDPOINT` (browser-reachable); server-side calls use `S3_ENDPOINT`. Local RustFS uses `http://localhost:9000` for the public endpoint.
- Never trust client MIME type or size; verify file signatures.

**Auth / CSRF**

- CSRF double-submit has **no exemptions**: every non-GET/HEAD/OPTIONS request, including login, register, refresh, and demo, needs `X-CSRF-Token` matching `cr_csrf`.
- When `cr_csrf` is missing, call `GET /auth/csrf` first. `cr_access` outlives the JWT so `TOKEN_EXPIRED` is observable; distinguish it from `UNAUTHENTICATED`.

**API conventions**

- Prefix `/api/v1`; success/error envelopes, `errorCode` catalog, and response shapes are fixed in ARCHITECTURE §10.2 and §30. Use the documented codes, not ad-hoc ones.
- Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- Pagination: default `pageSize` 20, max 100; comparison changes default 50, max 100. Changes are ordered by `sequence_number` ASC.

## Testing expectations

- Tenant isolation suite (14 cases, ARCHITECTURE §20) must pass in CI and connect as the runtime role.
- Engine fixture/snapshot tests for realistic document pairs; determinism (100 identical runs) and 5,000-block performance test.
- Integration tests use real PostgreSQL, Redis, and S3-compatible storage (RustFS) via Testcontainers.
- Coverage targets: engine and guards ≥ 90%, overall ≥ 70%.

## Read these first

1. `docs/TASKS.md` — find the current phase and exact checklist.
2. The matching `docs/ARCHITECTURE.md` sections referenced by that phase (e.g. Phase 2 → §8, §22–§29; Phase 3 → §9.1; Phase 5 → §11; Phase 7 → §14).
3. Check the "Changes in v2.1" tables in both docs before implementing auth, uploads, comparisons, AI, or demo.
