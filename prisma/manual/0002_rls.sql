-- Row Level Security (ARCHITECTURE §27). Applied to all 13 tenant tables;
-- `users` and `sessions` are global and intentionally have no RLS.
-- ENABLE + FORCE means even the table owner is subject to the policies.

-- Generic tenant policy for tables whose only rule is workspace_id equality.
DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents', 'stored_files', 'document_versions', 'comparison_runs',
    'comparison_changes', 'change_evidence', 'change_reviews',
    'ai_analyses', 'ai_insights', 'processing_records'
  ]::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format($policy$
        CREATE POLICY tenant_isolation ON public.%I
          USING (workspace_id = app_current_workspace_id())
          WITH CHECK (workspace_id = app_current_workspace_id())
      $policy$, t);
    END IF;
  END LOOP;
END
$rls$;

-- workspaces is the root tenant: SELECT is allowed for the active workspace
-- or for any workspace the current user is a member of (workspace switcher).
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'workspaces' AND policyname = 'workspaces_select'
  ) THEN
    CREATE POLICY workspaces_select ON public.workspaces FOR SELECT
      USING (
        id = app_current_workspace_id()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members m
          WHERE m.workspace_id = workspaces.id
            AND m.user_id = app_current_user_id()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'workspaces' AND policyname = 'workspaces_write'
  ) THEN
    CREATE POLICY workspaces_write ON public.workspaces FOR ALL
      USING (id = app_current_workspace_id())
      WITH CHECK (id = app_current_workspace_id());
  END IF;
END
$rls$;

-- Members can list their own memberships (across workspaces) for the switcher;
-- all writes require the active workspace context.
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'workspace_members' AND policyname = 'workspace_members_select'
  ) THEN
    CREATE POLICY workspace_members_select ON public.workspace_members FOR SELECT
      USING (
        workspace_id = app_current_workspace_id()
        OR user_id = app_current_user_id()
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'workspace_members' AND policyname = 'workspace_members_write'
  ) THEN
    CREATE POLICY workspace_members_write ON public.workspace_members FOR ALL
      USING (workspace_id = app_current_workspace_id())
      WITH CHECK (workspace_id = app_current_workspace_id());
  END IF;
END
$rls$;

-- An invitee may read exactly the invitation whose token hash is in context,
-- before they are a member of the workspace.
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations FORCE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'workspace_invitations' AND policyname = 'workspace_invitations_select'
  ) THEN
    CREATE POLICY workspace_invitations_select ON public.workspace_invitations FOR SELECT
      USING (
        workspace_id = app_current_workspace_id()
        OR token_hash = app_invitation_token_hash()
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'workspace_invitations' AND policyname = 'workspace_invitations_write'
  ) THEN
    CREATE POLICY workspace_invitations_write ON public.workspace_invitations FOR ALL
      USING (workspace_id = app_current_workspace_id())
      WITH CHECK (workspace_id = app_current_workspace_id());
  END IF;
END
$rls$;
