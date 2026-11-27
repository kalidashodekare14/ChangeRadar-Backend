-- Runtime privileges for changeradar_app (ARCHITECTURE §8.4, DB-06).
-- Idempotent; runs after Prisma Migrate creates the tables.

GRANT USAGE ON SCHEMA public TO changeradar_app;

-- Global tables: only auth/user services access them, by id/email/token hash.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO changeradar_app;

-- Tenant tables: DML is still filtered by RLS with tenant context.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stored_files TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparison_runs TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_reviews TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO changeradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_records TO changeradar_app;

-- Immutable comparison output: insert-only (no UPDATE privilege at all).
GRANT SELECT, INSERT, DELETE ON public.comparison_changes TO changeradar_app;
GRANT SELECT, INSERT, DELETE ON public.change_evidence TO changeradar_app;
GRANT SELECT, INSERT, DELETE ON public.ai_insights TO changeradar_app;
REVOKE UPDATE ON public.comparison_changes FROM changeradar_app;
REVOKE UPDATE ON public.change_evidence FROM changeradar_app;
REVOKE UPDATE ON public.ai_insights FROM changeradar_app;

-- document_versions is immutable except for the three extraction fields.
GRANT SELECT, INSERT, DELETE ON public.document_versions TO changeradar_app;
REVOKE UPDATE ON public.document_versions FROM changeradar_app;
GRANT UPDATE (extracted_text, extraction_metadata, processing_status)
  ON public.document_versions TO changeradar_app;
