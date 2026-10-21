-- GENERATED from schema.target.prisma — do not hand-edit.
-- Regenerate: cd server && npx prisma migrate diff --from-empty --to-schema-datamodel ../docs/database/schema.target.prisma --script > ../docs/database/schema.target.sql
-- Then apply constraints.sql in the same migration.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'DESIGNER', 'IT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('Urgent', 'High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('A', 'H', 'G');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FinishToStart', 'StartToStart', 'FinishToFinish');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('Comment', 'Question', 'Answer', 'Feedback');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('attachment', 'reference', 'result', 'voice');

-- CreateEnum
CREATE TYPE "VoicePurpose" AS ENUM ('Instruction', 'Submission', 'Comment', 'ReviewFeedback');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('NotRequested', 'Pending', 'Processing', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('Queued', 'Running', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('Created', 'Assigned', 'Reassigned', 'Accepted', 'Started', 'Paused', 'Resumed', 'Waiting', 'Activated', 'Submitted', 'Approved', 'Rejected', 'Reopened', 'Cancelled', 'Commented', 'FileAdded', 'FileRemoved', 'ChecklistUpdated', 'DependencyAdded', 'DependencyRemoved', 'AiRun', 'Deleted');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('Reminder', 'Assignment', 'System');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "head_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "lead_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL,
    "title" VARCHAR(80),
    "avatar_color" CHAR(7) NOT NULL DEFAULT '#2564CF',
    "department_id" UUID,
    "team_id" UUID,
    "daily_capacity" SMALLINT NOT NULL DEFAULT 8,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_types" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "ref_prefix" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "entity_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "entity_refs" (
    "id" UUID NOT NULL,
    "entity_type_code" VARCHAR(40) NOT NULL,
    "external_ref" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_types" (
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "default_action_type" "ActionType" NOT NULL DEFAULT 'H',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "business_event_types" (
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_event_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "task_type_code" VARCHAR(60) NOT NULL,
    "entity_type_code" VARCHAR(40),
    "department_id" UUID,
    "trigger_event_code" VARCHAR(60),
    "depends_on_task_type_code" VARCHAR(60),
    "priority" "Priority" NOT NULL DEFAULT 'Medium',
    "sla_hours" INTEGER,
    "estimated_minutes" INTEGER,
    "requires_review" BOOLEAN NOT NULL DEFAULT true,
    "requires_acceptance" BOOLEAN NOT NULL DEFAULT false,
    "ai_first_attempt" BOOLEAN NOT NULL DEFAULT false,
    "ai_agent_type" VARCHAR(60),
    "ai_min_quality_score" SMALLINT,
    "ai_fallback_department_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_checklist_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "sequence_no" SMALLINT NOT NULL,
    "item" VARCHAR(255) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "template_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_events" (
    "id" UUID NOT NULL,
    "event_type_code" VARCHAR(60) NOT NULL,
    "entity_ref_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(160),
    "payload" JSONB,
    "triggered_by_id" UUID,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "error_message" TEXT,

    CONSTRAINT "business_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_number_sequences" (
    "year" SMALLINT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_number_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "task_no" VARCHAR(30) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(255),
    "description" TEXT,
    "task_type_code" VARCHAR(60) NOT NULL,
    "action_type" "ActionType" NOT NULL DEFAULT 'H',
    "entity_ref_id" UUID NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'Medium',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "template_id" UUID,
    "source_event_id" UUID,
    "source_ai_run_id" UUID,
    "parent_task_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "assigned_user_id" UUID,
    "created_by_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "requires_acceptance" BOOLEAN NOT NULL DEFAULT false,
    "requires_review" BOOLEAN NOT NULL DEFAULT true,
    "ai_first_attempt" BOOLEAN NOT NULL DEFAULT false,
    "start_after" TIMESTAMPTZ(3),
    "due_at" TIMESTAMPTZ(3),
    "estimated_minutes" INTEGER,
    "started_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "completion_summary" TEXT,
    "attributes" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "reason" VARCHAR(500),
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "sequence_no" SMALLINT NOT NULL,
    "item" VARCHAR(255) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "completed_by_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "notes" TEXT,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "comment_type" "CommentType" NOT NULL DEFAULT 'Comment',
    "body" TEXT,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_files" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "kind" "FileKind" NOT NULL DEFAULT 'attachment',
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120),
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64),
    "storage_key" VARCHAR(512) NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "task_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_voice_notes" (
    "file_id" UUID NOT NULL,
    "purpose" "VoicePurpose" NOT NULL DEFAULT 'Instruction',
    "comment_id" UUID,
    "duration_seconds" INTEGER,
    "transcript" TEXT,
    "transcript_status" "TranscriptStatus" NOT NULL DEFAULT 'NotRequested',
    "language_code" VARCHAR(10),

    CONSTRAINT "task_voice_notes_pkey" PRIMARY KEY ("file_id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "dependency_type" "DependencyType" NOT NULL DEFAULT 'FinishToStart',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_ai_runs" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "agent_type" VARCHAR(60) NOT NULL,
    "model_name" VARCHAR(80),
    "run_status" "AiRunStatus" NOT NULL DEFAULT 'Queued',
    "input_file_id" UUID,
    "output_file_id" UUID,
    "confidence_score" DECIMAL(5,4),
    "quality_score" DECIMAL(5,4),
    "similarity_score" DECIMAL(5,4),
    "findings" JSONB,
    "result_summary" TEXT,
    "error_message" TEXT,
    "triggered_by_id" UUID,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activity" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "old_status" VARCHAR(20),
    "new_status" VARCHAR(20),
    "performed_by_id" UUID,
    "notes" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "task_id" UUID,
    "type" "NotificationType" NOT NULL DEFAULT 'System',
    "message" VARCHAR(500) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_department_id_code_key" ON "teams"("department_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_department_id_key" ON "teams"("id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_team_id_idx" ON "users"("team_id");

-- CreateIndex
CREATE INDEX "entity_refs_external_ref_idx" ON "entity_refs"("external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "entity_refs_entity_type_code_external_ref_key" ON "entity_refs"("entity_type_code", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_name_key" ON "task_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_code_key" ON "task_templates"("code");

-- CreateIndex
CREATE INDEX "task_templates_trigger_event_code_is_active_idx" ON "task_templates"("trigger_event_code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "template_checklist_items_template_id_sequence_no_key" ON "template_checklist_items"("template_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "business_events_idempotency_key_key" ON "business_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "business_events_entity_ref_id_received_at_idx" ON "business_events"("entity_ref_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_task_no_key" ON "tasks"("task_no");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_status_idx" ON "tasks"("assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "tasks_created_by_id_status_idx" ON "tasks"("created_by_id", "status");

-- CreateIndex
CREATE INDEX "tasks_reviewer_id_status_idx" ON "tasks"("reviewer_id", "status");

-- CreateIndex
CREATE INDEX "tasks_department_id_status_idx" ON "tasks"("department_id", "status");

-- CreateIndex
CREATE INDEX "tasks_status_due_at_idx" ON "tasks"("status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_entity_ref_id_task_type_code_idx" ON "tasks"("entity_ref_id", "task_type_code");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_template_id_idx" ON "tasks"("template_id");

-- CreateIndex
CREATE INDEX "tasks_completed_at_idx" ON "tasks"("completed_at");

-- CreateIndex
CREATE INDEX "task_assignments_task_id_assigned_at_idx" ON "task_assignments"("task_id", "assigned_at");

-- CreateIndex
CREATE INDEX "task_assignments_assignee_id_assigned_at_idx" ON "task_assignments"("assignee_id", "assigned_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_checklist_items_task_id_sequence_no_key" ON "task_checklist_items"("task_id", "sequence_no");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_comments_parent_comment_id_idx" ON "task_comments"("parent_comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_files_storage_key_key" ON "task_files"("storage_key");

-- CreateIndex
CREATE INDEX "task_files_task_id_kind_created_at_idx" ON "task_files"("task_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "task_voice_notes_comment_id_idx" ON "task_voice_notes"("comment_id");

-- CreateIndex
CREATE INDEX "task_dependencies_depends_on_task_id_idx" ON "task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_task_id_key" ON "task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "task_ai_runs_task_id_created_at_idx" ON "task_ai_runs"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_activity_task_id_created_at_idx" ON "task_activity"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_activity_created_at_idx" ON "task_activity"("created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_task_id_recipient_id_type_created_at_idx" ON "notifications"("task_id", "recipient_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_department_id_fkey" FOREIGN KEY ("team_id", "department_id") REFERENCES "teams"("id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_refs" ADD CONSTRAINT "entity_refs_entity_type_code_fkey" FOREIGN KEY ("entity_type_code") REFERENCES "entity_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_task_type_code_fkey" FOREIGN KEY ("task_type_code") REFERENCES "task_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_entity_type_code_fkey" FOREIGN KEY ("entity_type_code") REFERENCES "entity_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_trigger_event_code_fkey" FOREIGN KEY ("trigger_event_code") REFERENCES "business_event_types"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_depends_on_task_type_code_fkey" FOREIGN KEY ("depends_on_task_type_code") REFERENCES "task_types"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_ai_fallback_department_id_fkey" FOREIGN KEY ("ai_fallback_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_checklist_items" ADD CONSTRAINT "template_checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_event_type_code_fkey" FOREIGN KEY ("event_type_code") REFERENCES "business_event_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_entity_ref_id_fkey" FOREIGN KEY ("entity_ref_id") REFERENCES "entity_refs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_code_fkey" FOREIGN KEY ("task_type_code") REFERENCES "task_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_entity_ref_id_fkey" FOREIGN KEY ("entity_ref_id") REFERENCES "entity_refs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "business_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_ai_run_id_fkey" FOREIGN KEY ("source_ai_run_id") REFERENCES "task_ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_department_id_fkey" FOREIGN KEY ("team_id", "department_id") REFERENCES "teams"("id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_voice_notes" ADD CONSTRAINT "task_voice_notes_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "task_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_voice_notes" ADD CONSTRAINT "task_voice_notes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_ai_runs" ADD CONSTRAINT "task_ai_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_ai_runs" ADD CONSTRAINT "task_ai_runs_input_file_id_fkey" FOREIGN KEY ("input_file_id") REFERENCES "task_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_ai_runs" ADD CONSTRAINT "task_ai_runs_output_file_id_fkey" FOREIGN KEY ("output_file_id") REFERENCES "task_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_ai_runs" ADD CONSTRAINT "task_ai_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

