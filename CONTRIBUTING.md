# Contributing

## Work in phases

Work through `docs/TASKS.md` in order, one phase at a time. Do not skip Phase 2 (database and tenant isolation) or Phase 3 (authentication). Mark a task `[x]` only after it is implemented **and** verified.

If a design change is needed, update `docs/ARCHITECTURE.md` first, then `docs/TASKS.md`.

## Branches

- `main` is the deployable branch.
- Create a branch per phase or fix:
  - `feat/phase-0-foundation`
  - `feat/phase-1-core`
  - `fix/<short-description>`
  - `chore/<short-description>`
  - `docs/<short-description>`

Keep branches short-lived and rebase on `main` before opening a pull request.

## Commit messages (Conventional Commits)

Format:

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`.

Examples:

```text
feat(api): add health endpoint
fix(auth): clear cookies on revoked session
docs(tasks): complete phase 0 checklist
chore(deps): pin NestJS 12.6.3
```

Use the imperative mood and keep the subject under ~72 characters.

## Verification before a pull request

Run from the repository root:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run check:circular
npm run check:forbidden
npm test
npm run build
```

CI runs the same commands in this order: lint → format → typecheck → boundary checks → unit tests → build → runtime-only `npm audit`, plus a database job: roles → migrations on an empty database → manual SQL → tenant-isolation suite → build.

Also verify the relevant runtime path (API, Worker, infrastructure) for the phase you changed.

## Pull request checklist

- [ ] The change belongs to the current phase and respects the MVP scope.
- [ ] `ARCHITECTURE.md` was updated first for any design change.
- [ ] Tenant isolation rules are respected: tenant tables only through `TenantDb.run()`, no session-level `SET app.`, no `$queryRawUnsafe`/`$executeRawUnsafe`, and no external I/O inside a tenant transaction.
- [ ] Authorization is enforced in the backend; client-supplied workspace IDs are never trusted.
- [ ] No secrets, tokens, cookies, document text, prompts or presigned URLs are logged or committed.
- [ ] Error codes come from the documented catalog.
- [ ] Tests added/updated and listed verification commands pass.
- [ ] `docs/TASKS.md` status is accurate (`[ ]`, `[x]`, `[!]`, `[-]`).

## DTO and validation conventions

- HTTP DTOs use `class-validator` + `class-transformer` because Nest's `ValidationPipe` implements `whitelist`/`forbidNonWhitelisted`. Add validators to every exposed field.
- Zod is used for environment validation (`src/config/env.schema.ts`), and later for BullMQ job payloads and AI output. Do not read `process.env` outside the config module.
- Auth DTOs normalize emails (trim + lowercase). Login passwords are not length-validated so wrong credentials stay `INVALID_CREDENTIALS`; registration/change-password enforce the documented minimum.
- Jest matchers and supertest bodies are `any`, so the strict `no-unsafe-*` / `unbound-method` rules are relaxed for `test/**/*.ts` only — production `src/**` stays strict.
- Paginated handlers return `paginate(items, { page, pageSize, total })` so the global interceptor adds `meta`.
- Domain errors throw `AppException` with a code from the §30.2 catalog; never invent ad-hoc error codes.

## Security rules

- Never commit `.env`, credentials, keys or production URLs.
- `.env.example` is the only committed environment file.
- Local RustFS/PostgreSQL/Redis credentials are development-only defaults.
- Presigned URLs are signed for `S3_PUBLIC_ENDPOINT`; server-side calls use `S3_ENDPOINT`.
- Do not log request bodies that may contain passwords, tokens or document text.
- Passwords are argon2id hashes only; `PasswordHasher` is the sole place that hashes/verifies them. Refresh tokens are stored as SHA-256 hashes and never returned except at rotation.
- CSRF double-submit has no exemptions: every non-GET/HEAD/OPTIONS route needs `X-CSRF-Token` matching `cr_csrf`, including login/register/refresh. Never add a route that skips `CsrfGuard` without an architecture change.
- `users`/`sessions` are global tables accessed through repositories/prisma, not `TenantDb`; tenant writes during registration must use `TenantDb.runInTransaction(tx, ...)` inside the same Prisma transaction.
