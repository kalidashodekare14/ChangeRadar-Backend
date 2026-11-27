-- CHECK constraints and the optional composite FK that Prisma cannot express
-- (ARCHITECTURE §24, §25, §29). All statements are idempotent.

DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invitations_role_not_owner') THEN
    ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_role_not_owner
      CHECK (role <> 'OWNER'::workspace_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invitations_max_uses_positive') THEN
    ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_max_uses_positive
      CHECK (max_uses > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invitations_used_count_range') THEN
    ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_used_count_range
      CHECK (used_count >= 0 AND used_count <= max_uses);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stored_files_file_size_positive') THEN
    ALTER TABLE public.stored_files ADD CONSTRAINT stored_files_file_size_positive
      CHECK (file_size > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_version_number_positive') THEN
    ALTER TABLE public.document_versions ADD CONSTRAINT document_versions_version_number_positive
      CHECK (version_number > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comparison_runs_distinct_versions') THEN
    ALTER TABLE public.comparison_runs ADD CONSTRAINT comparison_runs_distinct_versions
      CHECK (source_version_id <> target_version_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comparison_changes_added_text') THEN
    ALTER TABLE public.comparison_changes ADD CONSTRAINT comparison_changes_added_text
      CHECK (category <> 'ADDED' OR (old_text IS NULL AND new_text IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comparison_changes_removed_text') THEN
    ALTER TABLE public.comparison_changes ADD CONSTRAINT comparison_changes_removed_text
      CHECK (category <> 'REMOVED' OR (new_text IS NULL AND old_text IS NOT NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_evidence_page_number_positive') THEN
    ALTER TABLE public.change_evidence ADD CONSTRAINT change_evidence_page_number_positive
      CHECK (page_number IS NULL OR page_number > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_evidence_offsets_ordered') THEN
    ALTER TABLE public.change_evidence ADD CONSTRAINT change_evidence_offsets_ordered
      CHECK (
        (start_offset IS NULL OR start_offset >= 0)
        AND (end_offset IS NULL OR start_offset IS NULL OR end_offset >= start_offset)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_evidence_excerpt_length') THEN
    ALTER TABLE public.change_evidence ADD CONSTRAINT change_evidence_excerpt_length
      CHECK (excerpt IS NULL OR char_length(excerpt) <= 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_reviews_note_length') THEN
    ALTER TABLE public.change_reviews ADD CONSTRAINT change_reviews_note_length
      CHECK (note IS NULL OR char_length(note) <= 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_insights_confidence_range') THEN
    ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_confidence_range
      CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1));
  END IF;

  -- Optional same-workspace FK: Prisma requires every field of an optional
  -- composite relation to be nullable, but workspace_id is NOT NULL.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_insights_workspace_comparison_change_fkey') THEN
    ALTER TABLE public.ai_insights
      ADD CONSTRAINT ai_insights_workspace_comparison_change_fkey
      FOREIGN KEY (workspace_id, comparison_change_id)
      REFERENCES public.comparison_changes (workspace_id, id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$checks$;
