# ChangeRadar Backend — TASKS.md

**Application:** Backend API + Background Worker (same repository, separate processes)
**Version:** 2.1 — Full Roadmap with MVP Scope (development-ready)
**Architecture:** `backend/ARCHITECTURE.md` (§ numbers below refer to it)
**Last updated:** 2026-11-27
**Status:** Phase 0 complete and verified; ready for Phase 1

---

## 0. Changes in v2.1 (readiness review)

Tasks were added or sharpened so the gaps closed in `ARCHITECTURE.md` v2.1 are built and tested in the right phase: local S3 CORS (RustFS) and public endpoint (Phase 0), `TRUST_PROXY_HOPS` (Phase 1), additive columns (Phase 2), CSRF bootstrap and cookie lifetimes (Phase 3), permission keys (Phase 4), upload idempotency (Phase 5), single-change endpoint and review counts (Phases 7–8), AI coverage (Phase 9), invitation preview (Phase 10), dashboard split and demo protection (Phase 11), client-IP verification (Phase 12).

---

## 1. How to Use This File

- **Part 1 — MVP Roadmap** is the work being done now (Phases 0–12, grouped into milestones M0–M3).
- **Part 2 — Future Scope** keeps every remaining task from the v1 roadmap. These tasks are marked `[-] Deferred` and **will not be done now**. They stay here so the project can be completed later in the same repository.
- Work one phase at a time, in order. Review the phase before starting the next one.
- Never skip Phase 2 (database and tenant isolation) or Phase 3 (authentication).
- A task is `[x]` only after it is implemented **and** verified.
- If the design changes, update `ARCHITECTURE.md` first, then this file.

### Core rules (from v1)

- Follow the approved architecture; database changes must match ARCHITECTURE Part C.
- Keep the deterministic comparison engine independent of AI.
- Enforce workspace authorization in the backend; apply Prisma scoping and RLS as defense in depth.
- Use transaction-scoped tenant context only (`TenantDb`).
- Never trust a client-supplied workspace ID without validating membership and ownership.
- Deferred features are added later only through additive changes (ARCHITECTURE §32).

### Status convention

`[ ]` not started · `[x]` completed and verified · `[!]` blocked (write the reason) · `[-]` not applicable or **Deferred** (with reason)

---

## 2. Overview

| Milestone | Phases | Result | Status |
|---|---|---|---|
| **M0 — Skeleton** | 0–1 | Empty app deployed to staging, CI green | Phase 0 done; Phase 1 next |
| **M1 — Core** | 2–7 | Upload two versions → deterministic comparison, deployed | Not started |
| **M2 — Intelligence** | 8–9 | Review workflow + AI analysis, deployed | Not started |
| **M3 — Portfolio release** | 10–12 | Invitations, dashboard, demo, hardening, public release | Not started |
| **Post-MVP** | F1–F9 | Remaining v1 roadmap | Deferred |

Estimated MVP effort: 9–11 weeks part-time for the backend alone. The frontend adds 7–9 weeks; one person building both applications should plan about 16–20 weeks in total. Every milestone ends with a staging deployment, so the project is always in a working state.

---

# PART 1 — MVP ROADMAP

## M0 — Skeleton

### Phase 0 — Repository Inspection and Foundation

**Goal:** Prepare the repository and understand its current state.

**Status:** Done — implemented and verified (2026-11-27). Next: Phase 1.

**Scope guard:** Phase 0 delivers a runnable skeleton plus local infrastructure only. Do **not** add a Prisma schema/migrations, auth, business modules, health endpoints, Dockerfile, CI, `madge`, or feature dependencies here — those belong to Phases 1–12. No application code beyond minimal entry points and bootstrap modules.

#### 0.1 Inspection result (completed during planning)

- [x] Inspect the existing backend repository (if any).
- [x] Review backend, frontend and database parts of `ARCHITECTURE.md`. *(Frontend companion docs referenced by ARCHITECTURE are not in this repository; §4–§5 system/frontend boundaries were reviewed.)*

Findings:

- Repository contains only `AGENTS.md`, `docs/ARCHITECTURE.md` (v2.1) and `docs/TASKS.md`. Branch `main`, one commit (`f66ac3a`), `AGENTS.md` currently untracked.
- No `package.json`, lockfile, `src/`, `prisma/`, tests, CI, Docker assets or `.env`.
- Local machine: Node.js `26.13.0`, npm `11.20.0`, Git `2.56.0`, Docker `29.9.3` / Compose `v5.7.1`. The Docker CLI is installed under `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin` and may need a shell/PATH refresh.
- **MinIO is no longer publicly available:** the `minio/minio` and `minio/mc` Docker Hub repositories are removed and `dl.min.io` returns `410 Gone`. Local storage therefore uses **RustFS 1.0.7** (Apache 2.0), which was verified for S3 bucket creation, presigned URLs, CORS preflight and lifecycle rules. The S3 adapter and `S3_*` contract are unchanged.
- API will use port **4000** locally (the frontend owns `3000`); RustFS console uses `9001`.

#### 0.2 Pinned technology baseline

Pin policy: exact versions in `package.json` (no `^` for framework/tooling), committed `package-lock.json`, Node pinned by `.nvmrc` + `engines`, upgrades only through reviewed dependency changes.

| Component | Pinned version | Reason / notes |
|---|---|---|
| Node.js | `26.13.0` (LTS line) | Installed locally; supported by Nest 12 / Prisma 7. |
| npm | `11.20.0` | Installed locally; `packageManager` + `engines`. |
| NestJS (`common`/`core`/`platform-express`/`testing`) | `12.6.3` | Current stable; Express adapter. CLI `12.0.15`, schematics `12.0.17`. |
| TypeScript | `6.0.3` | Nest 12 CLI/schematics require `^6.0.0`; `ts-jest` allows `<7` and `typescript-eslint@8.74.0` allows `<6.1`. |
| Prisma (`prisma`/`@prisma/client`/`@prisma/adapter-pg`) | `7.10.1` | **Not 8.0.0-rc.36 (RC).** Use the `prisma-client` generator, `moduleFormat = "cjs"`, `output = "../src/generated/prisma"`; runtime URL via `PrismaPg`; CLI URL via root `prisma.config.ts` (Phase 2). |
| Jest / ts-jest | `30.5.2` / `29.4.15` | Jest 30 + TypeScript 6 compatible. Test scripts pass `--experimental-vm-modules` because Nest packages are ESM-only. |
| Supertest | `7.3.2` | E2E in later phases. |
| ESLint / typescript-eslint | `10.15.0` / `8.74.0` | Flat config (`eslint.config.mjs`), type-aware rules. |
| Prettier | `3.10.1` | With `eslint-config-prettier`. |
| PostgreSQL (container) | `postgres:17-alpine` | Meets PostgreSQL 16+; pinned image. |
| Redis (container) | `redis:7.4-alpine` | BullMQ-compatible; pinned image. |
| MinIO (container) | ❌ unavailable | `minio/minio` Docker Hub repository and `dl.min.io` binaries are gone (410). Replaced by RustFS. |
| RustFS (container) | `rustfs/rustfs:1.0.7` | Apache 2.0 S3-compatible local storage; ports 9000/9001; verified CORS + lifecycle. |
| AWS CLI (storage init) | `amazon/aws-cli:2.42.4` | Creates the bucket, applies CORS and lifecycle through standard `s3api`; no dependency on `mc`. |

Compatibility decisions to keep in mind:

- Keep the backend source **CommonJS** (`"type": "commonjs"` in `package.json`) so Prisma’s `cjs` output and the existing tooling work; Nest 12 packages are ESM-only and are loaded through Node’s `require(esm)` support.
- `tsconfig.json` therefore uses `module: nodenext`, `moduleResolution: nodenext`, `resolvePackageJsonExports: true` (the official Nest 12 CommonJS template) plus explicit `types: ["node", "jest"]`. `module: commonjs`/`moduleResolution: node10` are deprecated in TypeScript 6.
- Jest requires `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` (as in the official Nest 12 CommonJS template) to load ESM-only Nest packages.
- Prisma 7 pins `effect@3.20.0` through `@prisma/config`; a `package.json` override to `effect@3.22.5` removes the high-severity ReDoS advisory without a major version jump. Jest’s dev-only `glob`/`minimatch` advisories remain (no compatible fix without downgrading Jest).
- TypeScript `target`/`lib` `ES2023`, `strict: true`, decorators + metadata enabled.
- Phase 0 does **not** run `prisma generate` (no schema yet). Package versions are still pinned now; generation starts in Phase 2.
- Feature dependencies (BullMQ, AWS SDK, argon2, AI, extractors) are added in their own phases using the versions in this baseline; Phase 0 installs only framework, test, lint and Prisma packages.

#### 0.3 Work breakdown

**P0-01 — Package manifest and toolchain**
- [x] Create `package.json` (`private`, `engines`, `packageManager`, pinned dependencies) and `.nvmrc` (`26.13.0`).
- [x] Create `.npmrc` (`save-exact=true`, `engine-strict=true`).
- [x] Add scripts: `build`, `start:api`, `start:worker`, `start:api:dev`, `start:worker:dev`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `test:coverage`.
- [x] Create `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.js`.
- [x] Install dependencies and commit `package-lock.json`.

**P0-02 — Folder skeleton (§7)**
- [x] Create the exact `src/` tree from §7: `config/`, `common/{errors,guards,decorators,interceptors,pagination}/`, `infrastructure/{database,storage,queue,redis}/`, and the MVP module folders (`auth`, `users`, `workspaces`, `invitations`, `authorization`, `documents`, `versions`, `storage`, `extraction`, `comparisons/engine`, `reviews`, `ai-intelligence/providers`, `processing`, `dashboard`, `demo`, `health`).
- [x] Create `prisma/`, `test/{e2e,isolation,fixtures/documents}/`, `scripts/{db,storage}/`.
- [x] Add `.gitkeep` to empty leaf directories; no placeholder business logic.

**P0-03 — Entry points**
- [x] `src/app.module.ts` + `src/main.ts`: create the Nest app, `enableShutdownHooks()`, listen on `PORT` (default `4000`).
- [x] `src/worker.module.ts` + `src/worker.ts`: create a standalone application context (no HTTP server), log ready, stay alive via an explicit interval handle plus a signal-driven promise, close cleanly on `SIGTERM`/`SIGINT`. *(BullMQ keeps the Worker alive from Phase 6; the explicit wait prevents an immediate exit now.)*
- [x] Minimal bootstrap smoke test (`test/bootstrap.spec.ts`) compiling both root modules with `@nestjs/testing`.
- [x] Do **not** add controllers, global pipes/filters, prefix or `/health` yet — Phase 1.

**P0-04 — Environment conventions (§17)**
- [x] Create `.env.example` with every variable from §17, grouped and commented, safe local defaults and obvious placeholders for secrets.
- [x] Document the `S3_ENDPOINT` (server-side, `http://storage:9000` inside compose / `http://localhost:9000` from the host) vs `S3_PUBLIC_ENDPOINT` (browser-reachable `http://localhost:9000`) distinction.
- [x] Document local role strategy: compose creates the bootstrap superuser/database; `changeradar_migrator` and `changeradar_app` are created in Phase 2. `.env.example` shows the final runtime/migrator URLs; README notes the temporary bootstrap URL until Phase 2.
- [x] Set `TRUST_PROXY_HOPS=0`, `APP_URL=http://localhost:3000`, `AI_PROVIDER=fake`, `DEMO_ENABLED=false`, `SWAGGER_ENABLED=true`, `LOG_LEVEL=info`.
- [x] Ensure `.env` is ignored and no real secret is committed.

**P0-05 — ESLint and Prettier**
- [x] `eslint.config.mjs` (flat): `@eslint/js`, `typescript-eslint` type-aware recommended, `eslint-config-prettier`; ignore `dist/`, `coverage/`, `src/generated/`, `node_modules/`.
- [x] `.prettierrc`, `.prettierignore`, `.editorconfig`.
- [x] Verify `npm run lint`, `npm run format:check` on the skeleton.

**P0-06 — Git hygiene and conventions**
- [x] `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.env*` (except `.env.example`), `src/generated/`, logs, OS/editor files, local volume data.
- [x] `.gitattributes`: `* text=auto eol=lf`; force LF for `*.sh` (storage init runs in Linux), CRLF for `*.bat`/`*.ps1`.
- [x] `CONTRIBUTING.md`: Conventional Commits (`feat|fix|chore|docs|refactor|test|build|ci|perf|revert`), branch naming (`feat/phase-0-foundation`, `fix/…`, `chore/…`), PR checklist (phase, invariants, verification evidence).
- [x] Decision: no Husky/commitlint hooks in Phase 0 (avoid install friction); revisit when CI lands in Phase 1.

**P0-07 — Local infrastructure (compose + RustFS init)**
- [x] `docker-compose.yml`: `postgres`, `redis`, `storage` (RustFS), `storage-permissions`, `storage-init`; named volumes, healthchecks, one network; pinned images. API/Worker services are added in Phase 1 after the Dockerfile.
- [x] PostgreSQL: database `changeradar`, bootstrap user/password local-only, container port `5432` published as host port `5433` by default (`POSTGRES_PORT`) because 5432 may be occupied by a local PostgreSQL.
- [x] Redis: append-only, port `6379`.
- [x] RustFS: ports `9000`/`9001`, private bucket `changeradar` (from `S3_BUCKET`), local-only credentials; run as UID/GID `10001:10001` with a one-shot volume-permission helper.
- [x] `scripts/storage/init.sh`: wait for storage, create bucket if missing, block public access, apply CORS, add the `uploads/` 1-day expiry rule, then print the applied rules. Use `amazon/aws-cli` with `s3api` — no `mc` dependency.
- [x] `scripts/storage/cors.json` + `scripts/storage/lifecycle.json`: allow `PUT` and `GET` from `APP_URL` (`http://localhost:3000`), header `Content-Type`, expose `ETag`; expire the `uploads/` prefix after 1 day.
- [x] Verify the exact AWS CLI `s3api` payloads against the pinned RustFS/AWS CLI versions rather than assuming.

**P0-08 — README and local setup**
- [x] `README.md`: purpose, architecture summary, repository layout, prerequisites (Node 26, npm 11, Docker Desktop), quick start, scripts table, ports table (frontend 3000, API 4000, Postgres 5433 host/5432 container, Redis 6379, RustFS 9000/9001), API vs Worker responsibilities, troubleshooting, docs links.
- [x] Explicit “no secrets committed” and “`.env.example` is the only committed env file”.
- [x] Document that health endpoints, config validation, DB migrations and roles arrive in Phases 1–2.

**P0-09 — Verification and documentation sync**
- [x] `npm ci` from a clean `node_modules` succeeds.
- [x] `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build` all pass.
- [x] API starts (`npm run start:api:dev`) and listens on `:4000`; stops cleanly. (Verified 404 for `/` as no routes exist yet.)
- [x] Worker starts (`npm run start:worker:dev`), logs ready, stays alive, stops cleanly.
- [x] `docker compose config` validates; `docker compose up -d` makes all services healthy (or `storage-init` exits 0).
- [x] RustFS bucket exists, is private, CORS preflight from `http://localhost:3000` returns `PUT`/`GET` + `ETag`, and `uploads/` expiry is listed.
- [x] `git status` shows only intended files; `.env` and generated output are not tracked.
- [x] Update `AGENTS.md` “Repository state” with the scaffold, scripts and actual commands now that they exist.
- [x] Tick Phase 0 items and set “Current phase” to Phase 1.

#### 0.4 Files to create in Phase 0

```text
.nvmrc  .npmrc  .gitignore  .gitattributes  .editorconfig
.env.example
eslint.config.mjs  .prettierrc  .prettierignore
package.json  package-lock.json
nest-cli.json  tsconfig.json  tsconfig.build.json
README.md  CONTRIBUTING.md
docker-compose.yml
scripts/storage/init.sh  scripts/storage/cors.json  scripts/storage/lifecycle.json
src/main.ts  src/worker.ts  src/app.module.ts  src/worker.module.ts
src/config/  src/common/…  src/infrastructure/…  src/modules/…
prisma/  test/bootstrap.spec.ts  jest.config.js
test/e2e/  test/isolation/  test/fixtures/documents/
```

#### 0.5 Phase 0 Definition of Done

- `npm ci && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` passes.
- API and Worker both start locally with documented responsibilities and clean shutdown.
- Local Postgres/Redis/RustFS come up healthy via one command; bucket, CORS and lifecycle are correct.
- `.env.example` covers every §17 variable and no secret is committed.
- `README.md`, `CONTRIBUTING.md` and `AGENTS.md` match the actual scaffold and scripts.
- Only then mark Phase 0 `[x]`.

#### 0.6 Risks / blockers

- **Resolved:** Docker Desktop is now installed (29.9.3 / Compose 5.7.1); the CLI may require a PATH refresh in existing shells.
- **Resolved — storage provider:** MinIO community images and binaries are no longer publicly distributed, so local storage uses RustFS 1.0.7. Bucket creation, presigned URLs, CORS preflight and lifecycle were verified before adopting it. Re-check RustFS image tags per release.
- **Resolved — host port conflict:** a local PostgreSQL process owns host port 5432. Compose now publishes `POSTGRES_PORT` (default `5433`) to container 5432; no local service was stopped.
- **Resolved — dependency tree:** Nest 12 CLI/schematics require TypeScript `^6.0.0`; `typescript-eslint@8.74.0` allows `<6.1`, so `6.0.3` was pinned. The vulnerable `effect` pinned by `@prisma/config` is overridden to `3.22.5`; only dev-only `glob`/`minimatch` advisories remain.
- **Resolved — ESM-only Nest packages:** Node 26 `require(esm)` plus Nest's official `nodenext` CommonJS tsconfig works; Jest scripts pass `--experimental-vm-modules`.
- Prisma 7 is ESM-first; the plan uses its `moduleFormat = "cjs"` option. Re-verify generation in Phase 2 when `schema.prisma` exists. If ESM output is required instead, switch the generator to `"esm"` consistently.
- Node 26 is new relative to some tooling; `ts-jest` works with the flag above. If it misbehaves later, record the fallback (Jest 30 + SWC or `isolatedModules`) before changing the pinned baseline.

**Acceptance criteria:** backend starts locally; API and Worker responsibilities documented; configuration conventions validated; no secrets committed.

### Phase 1 — Application Core and Shared Infrastructure

**Goal:** Reusable backend foundation + first deployment. (§10, §17, §19, §21)

- [ ] Configure NestJS bootstrap, global modules and shared providers.
- [ ] ConfigModule with environment validation (fail fast).
- [ ] Global `ValidationPipe` and DTO conventions.
- [ ] Global exception filter, `AppException`, error code catalog (§30.2).
- [ ] Success and error envelopes (§10.2) with correlation IDs.
- [ ] Structured logging (`nestjs-pino`) with redaction.
- [ ] `helmet`, cookie parser, `trust proxy` configured from `TRUST_PROXY_HOPS` (§18).
- [ ] Health and readiness endpoints.
- [ ] API prefix `/api/v1`.
- [ ] OpenAPI/Swagger.
- [ ] Module dependency boundary check (`madge`) in CI.
- [ ] Multi-stage Dockerfile (API + Worker commands).
- [ ] GitHub Actions CI: lint → typecheck → test → build.
- [ ] Choose hosting providers; deploy API + Worker skeleton to **staging**.
- [ ] Document shared infrastructure conventions.

**Acceptance criteria:** global validation and error handling work; API docs available; logs contain correlation IDs without secrets; staging deployment responds on `/api/v1/health`.

---

## M1 — Core

### Phase 2 — Database Foundation and Multi-Tenant Isolation ⭐

**Goal:** Implement the MVP schema and prove tenant isolation. (Part C, §8)

**Schema**
- [ ] Review ARCHITECTURE Part C completely.
- [ ] Write `schema.prisma` for the 15 MVP tables and their enums (§23–§24), including the v2.1 additions: `document_versions.upload_token_id` (+ partial unique index) and `ai_analyses.analyzed_change_count`.
- [ ] Verify every column, PK, FK, unique, check constraint and index against §24.
- [ ] Implement composite foreign keys (§25), including three-column same-document FKs.
- [ ] Verify delete behaviour (§26).
- [ ] Configure Prisma `url` (runtime role) and `directUrl` (migrator role).
- [ ] Generate the initial migration and review the SQL.

**Manual SQL migrations**
- [ ] Create `changeradar_migrator` and `changeradar_app` (`NOSUPERUSER NOBYPASSRLS`) — dev script + documented production steps.
- [ ] Helper functions `app_current_workspace_id()`, `app_current_user_id()`, `app_invitation_token_hash()`.
- [ ] Enable + force RLS; create policies for every tenant table (§27).
- [ ] CHECK constraints Prisma cannot express.
- [ ] Runtime grants; column-level UPDATE grants on `document_versions`; no UPDATE on `comparison_changes`, `change_evidence`, `ai_insights`.

**Access layer**
- [ ] `PrismaService` and `TenantDb.run()` with transaction-local context (§8.3).
- [ ] CI check forbidding session-level `SET app.` and `$queryRawUnsafe`.
- [ ] Reusable tenant-scoped repository pattern.
- [ ] Development seed script.
- [ ] Document global-data exceptions (`users`, `sessions`).
- [ ] Document migration and rollback procedure.

**Isolation tests (connect as runtime role)**
- [ ] Cases 1–4, 9–14 from §20 at database level.

**Acceptance criteria:** migrations run on an empty database in CI; RLS protects every tenant table; missing context exposes nothing; pooled connections do not leak context; cross-tenant tests pass.

### Phase 3 — Authentication and Identity

**Goal:** Secure authentication. (§9.1)

- [ ] User registration (normalized email, argon2id); creates personal workspace + OWNER membership.
- [ ] Login with generic `INVALID_CREDENTIALS`.
- [ ] Access token (JWT, 15 min) + refresh token cookies (§9.1). `cr_access` cookie `Max-Age` = remaining session lifetime; expired JWT with valid signature → `401 TOKEN_EXPIRED`; missing cookie / bad signature → `401 UNAUTHENTICATED`.
- [ ] `AuthGuard` (global, `@Public()` opt-out) with session revocation check; `@CurrentUser()`.
- [ ] Refresh token rotation (atomic hash replacement).
- [ ] Logout (revoke current session).
- [ ] Session list, revoke one, revoke others.
- [ ] Account profile retrieval and update.
- [ ] Password change (revokes other sessions).
- [ ] Cookie attributes and lifetimes exactly as in the §9.1 cookie table; all auth cookies cleared on logout and on `INVALID_REFRESH_TOKEN` / `SESSION_REVOKED`.
- [ ] CSRF double-submit protection with **no exemptions** (`CsrfGuard`); `GET /auth/csrf` (`@Public`) issues `cr_csrf`; cookie rotated on register, login, demo and refresh.
- [ ] Authentication rate limits (Redis throttler).
- [ ] Expired-session cleanup job (wired in Phase 6).
- [ ] E2E tests: register → me → refresh → logout; revoked session rejected; reused old refresh token rejected; missing CSRF rejected; 429 on brute force; **login and register without a CSRF header are rejected and succeed after `GET /auth/csrf`; an expired access JWT with the cookie still present returns `TOKEN_EXPIRED` and refresh then succeeds; the access cookie is still sent after the JWT expiry (Max-Age check).**
- [-] Google OAuth — **Deferred** (Future F1).
- [-] Email verification — **Deferred** (Future F1).
- [-] Forgot-password and password reset — **Deferred** (Future F1).

**Acceptance criteria:** auth flows work end to end; passwords never stored or logged in plaintext; sessions revocable; cookie and CSRF protections work; sensitive endpoints rate-limited.

### Phase 4 — Workspace, Membership and Authorization

**Goal:** Workspace identity and access control. (§9.2)

- [ ] Workspace creation (UUID generated in app, OWNER membership in same transaction).
- [ ] Workspace retrieval (returns `myRole` and `permissions`, §30.3) and update (name, `settings.aiEnabled`).
- [ ] Membership retrieval.
- [ ] Permission matrix for OWNER, ADMIN, MEMBER, VIEWER (`authorization` module) using the permission keys of §9.2 (including `document:delete:own`).
- [ ] `WorkspaceGuard` (404 for non-members) and `PermissionGuard` + `@RequirePermission()`.
- [ ] Role change (never to OWNER) and member removal; leave workspace.
- [ ] Last-owner protection with row lock.
- [ ] Workspace switching support (`GET /workspaces` with roles).
- [ ] Resource ownership checks in services.
- [ ] Workspace-scoped Prisma query patterns.
- [ ] E2E: full permission matrix test (every role × every action); non-member → 404. The `permissions` returned by `GET /workspaces/:ws` match the matrix for every role.
- [-] Workspace deletion lifecycle — **Deferred** (Future F8).
- [-] Ownership transfer — **Deferred** (Future F8).
- [-] Invitations — moved to Phase 10 (MVP).

**Acceptance criteria:** users cannot access other workspaces; roles enforced in the backend; context validated before protected operations; RLS adds a second layer.

### Phase 5 — Document Management and Storage

**Goal:** Documents, immutable versions and secure uploads. (§11, §24.6–24.8)

- [ ] Storage adapter (presigned PUT/GET, HEAD, stream, copy, delete).
- [ ] Document create, retrieve, update.
- [ ] Archive / unarchive and soft delete.
- [ ] Document listing with title filter, status filter, sorting and pagination. List and detail responses follow §30.3 (`createdBy`, `latestVersion`).
- [ ] Supported type validation (PDF, DOCX, TXT, Markdown) and size limits.
- [ ] Upload URL endpoint with signed upload token (includes `jti`); the presigned URL is built for `S3_PUBLIC_ENDPOINT`.
- [ ] Upload completion in the §11.1 order: token check → **idempotency lookup by `upload_token_id`** → HEAD → checksum and signature check → duplicate detection (against the latest non-FAILED version) → copy to final key → transaction; unique violation on `(workspace_id, upload_token_id)` returns the existing version.
- [ ] Transactional creation of `stored_files`, `document_versions` (sequential number with row lock) and `processing_records`.
- [ ] Enqueue extraction after commit.
- [ ] Version list, detail, content (blocks) and arbitrary version retrieval.
- [ ] Secure download URL.
- [ ] Bucket lifecycle rule for `uploads/`.
- [ ] Tests: concurrent uploads get sequential numbers; replayed token returns the same version (also after `tempKey` was deleted — never 409); two simultaneous completions with the same token create exactly one version; same file with a **new** token → 409; same file after a FAILED latest version → accepted; tampered/foreign token rejected; VIEWER cannot upload; a browser-style PUT to the presigned URL works against local RustFS (CORS).
- [-] Folders and subfolders — **Deferred** (Future F2).
- [-] Tags and categories — **Deferred** (Future F2).
- [-] Workspace-scoped full-text search — **Deferred** (Future F5).
- [-] Retention and secure hard deletion — **Deferred** (Future F8).

**Acceptance criteria:** uploads authorized and verified; versions immutable; storage private; every operation enforces workspace ownership.

### Phase 6 — Background Worker and Extraction Pipeline

**Goal:** Reliable jobs and structured content. (§12, §13)

- [ ] BullMQ queues and Zod payload schemas (§12.1).
- [ ] Processing lifecycle with `processing_records` (§12.2).
- [ ] Shared processor base (Tx1 → work → Tx2, FAILED handling) (§12.3).
- [ ] Retry, backoff, `UnrecoverableError`, concurrency, graceful shutdown, job correlation IDs.
- [ ] TXT extraction.
- [ ] Markdown extraction.
- [ ] DOCX text and structure extraction.
- [ ] PDF text extraction with page numbers.
- [ ] Normalization; paragraph, section, list and basic table boundaries; offsets.
- [ ] Extraction validation and limits (§11.3); unreadable/unsupported detection.
- [ ] Persist `extracted_text`, `extraction_metadata`, COMPLETED in one transaction.
- [ ] Maintenance repeatable jobs (expired sessions).
- [ ] Representative fixture files and extractor tests.
- [ ] Tests: retry does not duplicate; wrong-workspace payload fails; scanned PDF → `NO_TEXT_LAYER`.

**Acceptance criteria:** all four formats extract; source locations preserved; failures never appear as success; repeated jobs do not duplicate results.

### Phase 7 — Deterministic Comparison Engine ⭐

**Goal:** The core engine, independent of AI. (§14)

**Engine (pure module)**
- [ ] Domain model: `Block`, `CompareOptions`, `EngineChange`, `EngineEvidence`, `EngineResult`.
- [ ] Normalized block alignment.
- [ ] Detect ADDED and REMOVED.
- [ ] Detect MODIFIED with word-level inline diff.
- [ ] Detect STRUCTURAL (moved blocks, block type / heading level changes).
- [ ] Signals and deterministic severity (§14.3).
- [ ] Evidence (old/new side, offsets, section path, page).
- [ ] Fingerprints, stable order, `ENGINE_VERSION`.
- [ ] Unit tests per rule; fixture snapshot tests (≥ 5 realistic pairs).
- [ ] Determinism test (100 runs identical) and performance test (5,000 blocks < 5 s).

**Integration**
- [ ] Comparison creation with version pair validation (same document, different, both COMPLETED).
- [ ] Comparison lifecycle and status management.
- [ ] Persist changes + evidence + COMPLETED in one transaction.
- [ ] Comparison detail with `summary` (`total`, `byCategory`, `bySeverity`, `byReview`; §30.3). `byReview` joins `change_reviews`; a change without a review row is UNREVIEWED.
- [ ] Changes list ordered by `sequence_number` ASC with filters (`reviewStatus=UNREVIEWED` includes changes without a review row), evidence, review and pagination (default `pageSize` 50, max 100); `meta.total` is the filtered total.
- [ ] Single-change endpoint `GET …/changes/:changeId` returning the change plus `indexInFilter` (`null` when filtered out).
- [ ] Tests: `indexInFilter` correct with and without filters and `null` when filtered out; page boundaries stable on a 5,000-change fixture; summary counts equal list totals; `byReview` sums to `total`.
- [ ] Comparison history per document; full rerun creates a new run.
- [ ] Comparison idempotency (deterministic job ID).
- [-] SEMANTIC change detection — **Deferred** (Future F3).
- [-] FORMATTING change detection — **Deferred** (Future F3).
- [-] Comparison cancellation — **Deferred** (Future F3).

**Acceptance criteria:** works without AI; reproducible for the same inputs and engine version; every change linked to evidence; history preserved.

**🏁 M1 complete:** deploy to staging and run the smoke test (register → upload two versions → compare).

---

## M2 — Intelligence

### Phase 8 — Review Workflow

**Goal:** Human review of results. (§24.12)

- [ ] Review status management (Reviewed, Needs Attention, Ignored; missing row = Unreviewed).
- [ ] Review notes.
- [ ] Reviewer attribution and time.
- [ ] Review status authorization (MEMBER and above).
- [ ] Filter changes by review status.
- [ ] Concurrent review updates (upsert; last write wins with `updated_at` returned).
- [ ] Tests: VIEWER cannot review; review never modifies change content. `byReview` in the comparison summary updates after every review change and always sums to `total`; changing a review on a filtered list keeps `indexInFilter` consistent.
- [-] Full review history table — **Deferred** (Future F4).
- [-] Review activity events — **Deferred** (Future F6).

**Acceptance criteria:** review actions persisted; unauthorized users cannot change review state; review state consistent.

### Phase 9 — AI Intelligence

**Goal:** Evidence-grounded AI on top of deterministic results. (§15)

- [ ] AI domain model and provider adapter interface.
- [ ] `FakeAiProvider` for tests, CI and keyless runs.
- [ ] One primary provider adapter, isolated provider code.
- [ ] AI job orchestration with `processing_records`.
- [ ] Evidence selection and context preparation (minimized content): up to `AI_MAX_CHANGES` changes by severity (HIGH → MEDIUM → LOW), ties by `sequence_number`; store `analyzed_change_count`.
- [ ] Summaries, change explanations, potential business impact, contextual severity.
- [ ] Confidence and uncertainty representation.
- [ ] Evidence references required and validated.
- [ ] Facts vs potential impacts distinguished in output types.
- [ ] Zod output validation; malformed response retry once.
- [ ] Provider timeout and failure handling.
- [ ] Token usage and estimated cost recorded.
- [ ] AI-only rerun; previous analyses preserved.
- [ ] Analysis detail returns `analyzedChangeCount` and `totalChangeCount` (§30.3).
- [ ] Workspace AI privacy control (`settings.aiEnabled`).
- [ ] Daily safety limits (workspace + global).
- [ ] Tests: AI failure leaves comparison intact; invalid output → FAILED; unknown evidence dropped; disabled → 403; limit → 429. Changes outside the selected set have no insight and the coverage counts are exposed; selection order is deterministic.
- [-] Quota-based AI usage accounting — **Deferred** (Future F7).

**Acceptance criteria:** AI separate from comparison; output validated before persistence; uncertainty explicit; AI unavailability never disables comparison.

**🏁 M2 complete:** deploy to staging; smoke test includes review and AI (fake + real provider).

---

## M3 — Portfolio Release

### Phase 10 — Invitations and Team Membership

**Goal:** Team workspaces through invitation links. (§24.5, §27)

- [ ] Invitation creation (role ≤ ADMIN) returning a one-time visible link.
- [ ] Token hashing and validation.
- [ ] Expiration, usage limits, revocation.
- [ ] Invitation list for ADMIN/OWNER.
- [ ] Authenticated invitation preview that **always returns 200** with `status` (`PENDING` / `EXPIRED` / `REVOKED` / `EXHAUSTED`) and `emailMatches`; acceptance keeps the 410 / 403 / 409 error codes.
- [ ] Transactional acceptance with email match and duplicate-membership protection.
- [ ] Tests: expired, revoked, exhausted, wrong email, already member, cross-workspace isolation of invitations.
- [-] Sending invitation emails — **Deferred** (Future F1).

**Acceptance criteria:** a second user can join a workspace with the correct role through a link; invalid invitations are rejected.

### Phase 11 — Dashboard and Demo Mode

**Goal:** A pleasant first experience for visitors.

- [ ] Dashboard endpoint returns counts only (`documentCount`, `comparisonCount`, `needsAttentionCount`). Recent documents and comparisons use the existing list endpoints — verify `documents?status=ACTIVE&sort=updatedAt&order=desc&pageSize=5` and newest-first `comparisons?pageSize=5` (§30.3).
- [ ] Processing list endpoint (`status=active`) returning `label`, `documentId` and `comparisonId` (§30.3).
- [ ] Demo sample documents (original, license-free).
- [ ] `POST /auth/demo`: demo user + workspace + samples + finished comparison + a **pre-built AI analysis** created from hand-written fixture insights (no provider call). Returns `{ user, workspaceId, comparisonId }`, sets all cookies including `cr_csrf`.
- [ ] Demo cleanup job after 24 h (per-workspace context, storage objects removed).
- [ ] `DEMO_ENABLED` switch.
- [ ] Demo protection: per-IP limit `DEMO_RATE_LIMIT_PER_HOUR` (default 10) and cap `DEMO_MAX_ACTIVE` live demo workspaces (default 50) → `429 RATE_LIMITED`; `404` when `DEMO_ENABLED=false`. "Run AI" inside a demo uses the normal path and daily limits.
- [ ] Tests: demo creation and full cleanup. Demo returns a COMPLETED comparison and a COMPLETED AI analysis; cap and rate limit enforced.

**Acceptance criteria:** "Try demo" gives a populated workspace with a finished comparison in about 20 seconds.

### Phase 12 — Security, Testing and Release

**Goal:** Confidence and public release.

**Security review**
- [ ] Authentication and session security review.
- [ ] Authorization and resource ownership review (test that every route has a permission or `@Public`).
- [ ] CSRF, XSS-related output, SQL injection and SSRF review.
- [ ] File upload and object storage access review.
- [ ] RLS coverage review.
- [ ] Rate limits and secrets review.
- [ ] Client IP behind the frontend rewrite: on staging the IP logged by the API equals the visitor's IP; `TRUST_PROXY_HOPS` documented per environment; rate limits and the demo cap verified end to end through the frontend.
- [ ] Dependency vulnerability check in CI.
- [ ] Idempotency, retries and transaction boundaries review.
- [ ] Log review: run the E2E suite and search logs for document text.

**Testing**
- [ ] Complete isolation suite (§20, all 14 cases) via API and Worker.
- [ ] Coverage: engine and guards ≥ 90 %, overall ≥ 70 %.
- [ ] CI quality gates block failing tests, lint or migrations.

**Release**
- [ ] Production database roles and release migration step.
- [ ] Production secrets, bucket CORS and lifecycle rule.
- [ ] Error tracking for API and Worker; health checks.
- [ ] Production deployment + smoke test.
- [ ] Rollback and deployment procedures documented.
- [ ] Known limitations documented (link to Part 2).
- [ ] Portfolio README: problem, live demo, screenshots/GIF, architecture diagram, engineering highlights, isolation testing, trade-offs, roadmap.

**Acceptance criteria:** critical workflows pass; no unresolved critical security issue; tenant isolation verified across API, database and Worker; release documented.

**🏁 M3 complete — Portfolio MVP released.**

---

## Definition of Done (every MVP task)

1. Follows `ARCHITECTURE.md`; database changes match Part C.
2. Authorization and workspace isolation enforced (tenant tables only through `TenantDb`).
3. Required unit, integration or E2E tests pass.
4. Error handling uses documented error codes; logging in place.
5. No secrets or document contents exposed.
6. Migrations and OpenAPI documentation updated.
7. TypeScript, lint and build pass.
8. Marked `[x]` only after verification.

---

# PART 2 — FUTURE SCOPE (⏸ DEFERRED — NOT DONE NOW)

> These tasks come from the v1 roadmap. They are **not part of the MVP** and **will not be done now**. They remain here so the full product can be completed later. Before starting any of them, move the related item from ARCHITECTURE Part F into Parts B–D (ARCHITECTURE §32).

### F1 — Extended Authentication and Invitation Email
- [-] Implement Google OAuth (`auth_accounts`). — Deferred
- [-] Implement email verification (`verification_tokens`). — Deferred
- [-] Implement forgot-password flow. — Deferred
- [-] Implement password reset. — Deferred
- [-] Implement refresh-token reuse detection. — Deferred
- [-] Send invitation emails. — Deferred
- [-] Select and integrate an email provider. — Deferred

### F2 — Document Organization
- [-] Implement folder and subfolder management with cycle prevention. — Deferred
- [-] Add `documents.folder_id` (additive migration). — Deferred
- [-] Implement tags and categories (`tags`, `document_tags`). — Deferred
- [-] Cross-tenant tests for folders and tags. — Deferred

### F3 — Comparison Engine v2
- [-] Detect SEMANTIC changes using deterministic rules. — Deferred
- [-] Detect FORMATTING changes from richer extraction data. — Deferred
- [-] Implement comparison cancellation. — Deferred
- [-] Cross-document comparison (requires reviewed decision). — Deferred
- [-] Diff context blocks (`context=N` on the changes endpoints, ARCHITECTURE §33.30). — Deferred
- [-] OCR for scanned PDFs. — Deferred

### F4 — Review History
- [-] Implement `review_history` table and endpoints. — Deferred
- [-] Preserve review history across AI-only reruns. — Deferred

### F5 — Reports and Search
- [-] Define report domain model (`reports`). — Deferred
- [-] Implement report generation jobs and content assembly. — Deferred
- [-] Include summary, change details, severity, AI explanations and evidence references. — Deferred
- [-] Implement PDF report generation. — Deferred
- [-] Implement report metadata, history, authorized download and deletion lifecycle. — Deferred
- [-] Test report consistency against stored comparison results. — Deferred
- [-] Implement PostgreSQL Full-Text Search and Trigram Search with GIN indexes. — Deferred
- [-] Search documents, versions, reports and comparison data (workspace-scoped). — Deferred
- [-] Search filtering and pagination. — Deferred

### F6 — Notifications, Real-Time and Activity
- [-] Implement notification creation, persistence, unread count, mark-as-read, listing. — Deferred
- [-] Implement SSE delivery with authentication, authorization and reconnection. — Deferred
- [-] Implement activity event persistence (separate from audit logs). — Deferred
- [-] Review activity events. — Deferred

### F7 — Billing, Quotas and Usage Accounting
- [-] Implement subscription domain model and plan configuration. — Deferred
- [-] Implement workspace-level usage limits. — Deferred
- [-] Implement comparison and AI usage quota tracking. — Deferred
- [-] Implement usage reservation where required. — Deferred
- [-] Successful-only, idempotent usage accounting. — Deferred
- [-] Quota enforcement and usage summary endpoints. — Deferred
- [-] Subscription ownership checks, downgrade behaviour, historical data preservation. — Deferred
- [-] Billing provider integration. — Deferred
- [-] Replace MVP AI safety limits with quotas. — Deferred
- [-] Test duplicate and concurrent usage events. — Deferred

### F8 — Audit, Privacy and Data Lifecycle
- [-] Immutable security audit events (`audit_logs`). — Deferred
- [-] Record sensitive access, administrative actions, membership changes, security-relevant document operations. — Deferred
- [-] Prevent modification of audit history (append-only grants). — Deferred
- [-] Workspace data export. — Deferred
- [-] Workspace deletion workflow and ownership transfer. — Deferred
- [-] Document hard deletion lifecycle and object storage cleanup. — Deferred
- [-] Retention policy enforcement. — Deferred
- [-] Backup and recovery procedures with restore tests. — Deferred
- [-] Review AI provider data handling and data minimization. — Deferred
- [-] Test deletion and export completeness. — Deferred
- [-] Malware scanning / quarantine. — Deferred

### F9 — Operations and Platform
- [-] Processing attempt history (`processing_attempts`). — Deferred
- [-] Metrics dashboards, alerting and OpenTelemetry. — Deferred
- [-] Performance/load tests for all critical paths. — Deferred
- [-] Analytics, Support and Feature Flags modules. — Deferred
- [-] Additional AI providers. — Deferred

---

**Current phase:** Phase 1 — Application Core and Shared Infrastructure
**Overall status:** Phase 0 complete and verified; proceed to Phase 1 one checklist at a time
