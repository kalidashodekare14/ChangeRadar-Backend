# ChangeRadar Backend — TASKS.md

**Application:** Backend API + Background Worker (same repository, separate processes)
**Version:** 2.1 — Full Roadmap with MVP Scope (development-ready)
**Architecture:** `backend/ARCHITECTURE.md` (§ numbers below refer to it)
**Last updated:** 2026-11-27
**Status:** Ready for development (v2.1 readiness review applied)

---

## 0. Changes in v2.1 (readiness review)

Tasks were added or sharpened so the gaps closed in `ARCHITECTURE.md` v2.1 are built and tested in the right phase: MinIO CORS and public endpoint (Phase 0), `TRUST_PROXY_HOPS` (Phase 1), additive columns (Phase 2), CSRF bootstrap and cookie lifetimes (Phase 3), permission keys (Phase 4), upload idempotency (Phase 5), single-change endpoint and review counts (Phases 7–8), AI coverage (Phase 9), invitation preview (Phase 10), dashboard split and demo protection (Phase 11), client-IP verification (Phase 12).

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
| **M0 — Skeleton** | 0–1 | Empty app deployed to staging, CI green | Not started |
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

- [ ] Inspect the existing backend repository (if any).
- [ ] Review backend, frontend and database parts of `ARCHITECTURE.md`.
- [ ] Confirm and pin Node.js, NestJS, TypeScript and Prisma versions.
- [ ] Establish the modular monolith folder structure (§7).
- [ ] Establish API (`main.ts`) and Worker (`worker.ts`) entry points.
- [ ] Configure environment variable conventions and create `.env.example` (§17).
- [ ] Configure ESLint and Prettier.
- [ ] Configure `.gitignore`.
- [ ] Establish branch and commit conventions (Conventional Commits).
- [ ] Create `docker-compose.yml` (PostgreSQL, Redis, MinIO with bucket).
- [ ] MinIO init script: create the bucket, apply CORS (allow `PUT` and `GET` from `http://localhost:3000`, header `Content-Type`, expose `ETag`) and the `uploads/` 1-day lifecycle rule (§11.2).
- [ ] `.env.example` lists `S3_ENDPOINT` (server-side, e.g. `http://minio:9000`) and `S3_PUBLIC_ENDPOINT` (browser-reachable, e.g. `http://localhost:9000`).
- [ ] Document local development setup in `README.md`.
- [ ] Verify API and Worker both start.

**Acceptance criteria:** backend starts locally; API and Worker responsibilities documented; configuration validated; no secrets committed.

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
- [ ] Tests: concurrent uploads get sequential numbers; replayed token returns the same version (also after `tempKey` was deleted — never 409); two simultaneous completions with the same token create exactly one version; same file with a **new** token → 409; same file after a FAILED latest version → accepted; tampered/foreign token rejected; VIEWER cannot upload; a browser-style PUT to the presigned URL works against local MinIO (CORS).
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

**Current phase:** Phase 0 — ready to start
**Overall status:** Ready for development
