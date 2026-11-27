-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "workspace_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "workspace_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "document_processing_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "file_status" AS ENUM ('PENDING', 'AVAILABLE', 'FAILED', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "comparison_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "change_category" AS ENUM ('ADDED', 'REMOVED', 'MODIFIED', 'STRUCTURAL', 'SEMANTIC', 'FORMATTING');

-- CreateEnum
CREATE TYPE "change_severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('UNREVIEWED', 'REVIEWED', 'NEEDS_ATTENTION', 'IGNORED');

-- CreateEnum
CREATE TYPE "ai_analysis_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ai_insight_type" AS ENUM ('EXPLANATION', 'BUSINESS_IMPACT', 'RISK', 'RECOMMENDATION', 'SUMMARY');

-- CreateEnum
CREATE TYPE "processing_type" AS ENUM ('DOCUMENT_EXTRACTION', 'COMPARISON', 'AI_ANALYSIS', 'REPORT_GENERATION');

-- CreateEnum
CREATE TYPE "processing_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "ip_address" inet,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "status" "workspace_status" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "workspace_role" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "workspace_role" NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "invited_by" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "document_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "storage_provider" VARCHAR(50) NOT NULL,
    "bucket_name" VARCHAR(255) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_extension" VARCHAR(20) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "status" "file_status" NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "stored_file_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "extracted_text" TEXT,
    "extraction_metadata" JSONB,
    "processing_status" "document_processing_status" NOT NULL DEFAULT 'PENDING',
    "uploaded_by" UUID NOT NULL,
    "upload_token_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "source_version_id" UUID NOT NULL,
    "target_version_id" UUID NOT NULL,
    "status" "comparison_status" NOT NULL DEFAULT 'QUEUED',
    "engine_version" VARCHAR(50) NOT NULL,
    "configuration" JSONB,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_changes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "comparison_run_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "category" "change_category" NOT NULL,
    "severity" "change_severity",
    "old_text" TEXT,
    "new_text" TEXT,
    "old_location" JSONB,
    "new_location" JSONB,
    "fingerprint" VARCHAR(128),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_evidence" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "comparison_change_id" UUID NOT NULL,
    "evidence_type" VARCHAR(50) NOT NULL,
    "source_version_id" UUID NOT NULL,
    "page_number" INTEGER,
    "section_path" TEXT,
    "start_offset" BIGINT,
    "end_offset" BIGINT,
    "excerpt" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_reviews" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "comparison_change_id" UUID NOT NULL,
    "status" "review_status" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "comparison_run_id" UUID NOT NULL,
    "status" "ai_analysis_status" NOT NULL DEFAULT 'QUEUED',
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "prompt_version" VARCHAR(80) NOT NULL,
    "analyzed_change_count" INTEGER,
    "input_tokens" BIGINT,
    "output_tokens" BIGINT,
    "estimated_cost" DECIMAL(12,6),
    "error_code" VARCHAR(100),
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "ai_analysis_id" UUID NOT NULL,
    "comparison_change_id" UUID,
    "type" "ai_insight_type" NOT NULL,
    "title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "severity" "change_severity",
    "confidence_score" DECIMAL(5,4),
    "is_uncertain" BOOLEAN NOT NULL DEFAULT false,
    "evidence_references" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_records" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "job_id" VARCHAR(255) NOT NULL,
    "type" "processing_type" NOT NULL,
    "status" "processing_status" NOT NULL DEFAULT 'QUEUED',
    "resource_type" VARCHAR(80) NOT NULL,
    "resource_id" UUID NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "error_code" VARCHAR(100),
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_active_idx" ON "sessions"("user_id") WHERE ("revoked_at" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_role_idx" ON "workspace_members"("workspace_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_id_key" ON "workspace_members"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_token_hash_key" ON "workspace_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspace_id_status_idx" ON "workspace_invitations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspace_id_email_idx" ON "workspace_invitations"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "workspace_invitations_expires_at_idx" ON "workspace_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_workspace_id_id_key" ON "workspace_invitations"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "documents_workspace_id_created_at_idx" ON "documents"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "documents_workspace_id_status_idx" ON "documents"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "documents_workspace_id_id_key" ON "documents"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "stored_files_workspace_id_checksum_sha256_idx" ON "stored_files"("workspace_id", "checksum_sha256");

-- CreateIndex
CREATE INDEX "stored_files_workspace_id_status_idx" ON "stored_files"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_provider_bucket_name_storage_key_key" ON "stored_files"("storage_provider", "bucket_name", "storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_workspace_id_id_key" ON "stored_files"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "document_versions_workspace_id_document_id_version_number_idx" ON "document_versions"("workspace_id", "document_id", "version_number" DESC);

-- CreateIndex
CREATE INDEX "document_versions_workspace_id_processing_status_idx" ON "document_versions"("workspace_id", "processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_workspace_id_document_id_version_number_key" ON "document_versions"("workspace_id", "document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_workspace_id_id_key" ON "document_versions"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_workspace_id_document_id_id_key" ON "document_versions"("workspace_id", "document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_workspace_id_upload_token_id_key" ON "document_versions"("workspace_id", "upload_token_id") WHERE ("upload_token_id" IS NOT NULL);

-- CreateIndex
CREATE INDEX "comparison_runs_workspace_id_created_at_idx" ON "comparison_runs"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comparison_runs_document_id_created_at_idx" ON "comparison_runs"("document_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comparison_runs_workspace_id_status_idx" ON "comparison_runs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "comparison_runs_source_version_id_idx" ON "comparison_runs"("source_version_id");

-- CreateIndex
CREATE INDEX "comparison_runs_target_version_id_idx" ON "comparison_runs"("target_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_runs_workspace_id_id_key" ON "comparison_runs"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "comparison_changes_workspace_id_comparison_run_id_idx" ON "comparison_changes"("workspace_id", "comparison_run_id");

-- CreateIndex
CREATE INDEX "comparison_changes_comparison_run_id_category_idx" ON "comparison_changes"("comparison_run_id", "category");

-- CreateIndex
CREATE INDEX "comparison_changes_comparison_run_id_severity_idx" ON "comparison_changes"("comparison_run_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_changes_comparison_run_id_sequence_number_key" ON "comparison_changes"("comparison_run_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_changes_workspace_id_id_key" ON "comparison_changes"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "change_evidence_workspace_id_comparison_change_id_idx" ON "change_evidence"("workspace_id", "comparison_change_id");

-- CreateIndex
CREATE INDEX "change_evidence_source_version_id_idx" ON "change_evidence"("source_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_evidence_workspace_id_id_key" ON "change_evidence"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "change_reviews_comparison_change_id_key" ON "change_reviews"("comparison_change_id");

-- CreateIndex
CREATE INDEX "change_reviews_workspace_id_status_idx" ON "change_reviews"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "change_reviews_workspace_id_reviewed_by_idx" ON "change_reviews"("workspace_id", "reviewed_by");

-- CreateIndex
CREATE UNIQUE INDEX "change_reviews_workspace_id_id_key" ON "change_reviews"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "change_reviews_workspace_id_comparison_change_id_key" ON "change_reviews"("workspace_id", "comparison_change_id");

-- CreateIndex
CREATE INDEX "ai_analyses_workspace_id_comparison_run_id_created_at_idx" ON "ai_analyses"("workspace_id", "comparison_run_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_analyses_workspace_id_status_idx" ON "ai_analyses"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_workspace_id_id_key" ON "ai_analyses"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "ai_insights_workspace_id_ai_analysis_id_idx" ON "ai_insights"("workspace_id", "ai_analysis_id");

-- CreateIndex
CREATE INDEX "ai_insights_workspace_id_comparison_change_id_idx" ON "ai_insights"("workspace_id", "comparison_change_id");

-- CreateIndex
CREATE INDEX "ai_insights_ai_analysis_id_type_idx" ON "ai_insights"("ai_analysis_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ai_insights_workspace_id_id_key" ON "ai_insights"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_records_job_id_key" ON "processing_records"("job_id");

-- CreateIndex
CREATE INDEX "processing_records_workspace_id_status_created_at_idx" ON "processing_records"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "processing_records_workspace_id_resource_type_resource_id_idx" ON "processing_records"("workspace_id", "resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_records_workspace_id_id_key" ON "processing_records"("workspace_id", "id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_workspace_id_document_id_fkey" FOREIGN KEY ("workspace_id", "document_id") REFERENCES "documents"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_workspace_id_stored_file_id_fkey" FOREIGN KEY ("workspace_id", "stored_file_id") REFERENCES "stored_files"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_runs" ADD CONSTRAINT "comparison_runs_workspace_id_document_id_fkey" FOREIGN KEY ("workspace_id", "document_id") REFERENCES "documents"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_runs" ADD CONSTRAINT "comparison_runs_workspace_id_document_id_source_version_id_fkey" FOREIGN KEY ("workspace_id", "document_id", "source_version_id") REFERENCES "document_versions"("workspace_id", "document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_runs" ADD CONSTRAINT "comparison_runs_workspace_id_document_id_target_version_id_fkey" FOREIGN KEY ("workspace_id", "document_id", "target_version_id") REFERENCES "document_versions"("workspace_id", "document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_runs" ADD CONSTRAINT "comparison_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_changes" ADD CONSTRAINT "comparison_changes_workspace_id_comparison_run_id_fkey" FOREIGN KEY ("workspace_id", "comparison_run_id") REFERENCES "comparison_runs"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_evidence" ADD CONSTRAINT "change_evidence_workspace_id_comparison_change_id_fkey" FOREIGN KEY ("workspace_id", "comparison_change_id") REFERENCES "comparison_changes"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_evidence" ADD CONSTRAINT "change_evidence_workspace_id_source_version_id_fkey" FOREIGN KEY ("workspace_id", "source_version_id") REFERENCES "document_versions"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_reviews" ADD CONSTRAINT "change_reviews_workspace_id_comparison_change_id_fkey" FOREIGN KEY ("workspace_id", "comparison_change_id") REFERENCES "comparison_changes"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_reviews" ADD CONSTRAINT "change_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_workspace_id_comparison_run_id_fkey" FOREIGN KEY ("workspace_id", "comparison_run_id") REFERENCES "comparison_runs"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_workspace_id_ai_analysis_id_fkey" FOREIGN KEY ("workspace_id", "ai_analysis_id") REFERENCES "ai_analyses"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_records" ADD CONSTRAINT "processing_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
