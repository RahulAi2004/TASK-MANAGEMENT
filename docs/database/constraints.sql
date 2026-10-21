-- Decoinks Task Management — integrity rules Prisma's schema language cannot express.
-- Apply in the SAME migration as schema.target.sql (append to the generated migration.sql).
-- Every rule here mirrors a rule the API already enforces — the database is the last line of defence.

-- ── Task status: closed set, kept as VARCHAR because the labels ("In Progress") are API contract ──
ALTER TABLE tasks ADD CONSTRAINT tasks_status_chk CHECK (status IN
  ('Pending','Assigned','Accepted','In Progress','Waiting','On Hold','Submitted','Completed','Rejected','Reopened','Cancelled'));
ALTER TABLE task_activity ADD CONSTRAINT task_activity_old_status_chk CHECK (old_status IS NULL OR old_status IN
  ('Pending','Assigned','Accepted','In Progress','Waiting','On Hold','Submitted','Completed','Rejected','Reopened','Cancelled'));
ALTER TABLE task_activity ADD CONSTRAINT task_activity_new_status_chk CHECK (new_status IS NULL OR new_status IN
  ('Pending','Assigned','Accepted','In Progress','Waiting','On Hold','Submitted','Completed','Rejected','Reopened','Cancelled'));

-- ── Tasks ──────────────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD CONSTRAINT tasks_completed_at_chk       CHECK ((status = 'Completed') = (completed_at IS NOT NULL));
ALTER TABLE tasks ADD CONSTRAINT tasks_assignee_required_chk  CHECK (status IN ('Pending','Waiting','Cancelled') OR assigned_user_id IS NOT NULL);
ALTER TABLE tasks ADD CONSTRAINT tasks_not_own_parent_chk     CHECK (parent_task_id IS NULL OR parent_task_id <> id);
ALTER TABLE tasks ADD CONSTRAINT tasks_schedule_chk           CHECK (due_at IS NULL OR start_after IS NULL OR due_at >= start_after);
ALTER TABLE tasks ADD CONSTRAINT tasks_estimate_chk           CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_task_no_format_chk     CHECK (task_no ~ '^TASK-[0-9]{4}-[0-9]{5,}$');

-- Hot path for dashboards, overdue sweep and workload: only live, unfinished tasks.
CREATE INDEX tasks_open_due_idx ON tasks (due_at)
  WHERE deleted_at IS NULL AND status NOT IN ('Completed','Cancelled');
CREATE INDEX tasks_open_assignee_idx ON tasks (assigned_user_id, status)
  WHERE deleted_at IS NULL;

-- Automation idempotency backstop: at most one OPEN event-generated task of a given type per
-- business record. Manual / "Use template" tasks are exempt (two mockups for one artwork is valid).
CREATE UNIQUE INDEX tasks_one_open_per_entity_type_uq ON tasks (entity_ref_id, task_type_code)
  WHERE deleted_at IS NULL AND status NOT IN ('Completed','Cancelled') AND source_event_id IS NOT NULL;

-- ── Assignments: exactly one open assignment per task ───────────────────────────
CREATE UNIQUE INDEX task_assignments_one_open_uq ON task_assignments (task_id) WHERE released_at IS NULL;
ALTER TABLE task_assignments ADD CONSTRAINT task_assignments_span_chk
  CHECK ((released_at IS NULL OR released_at >= assigned_at) AND (accepted_at IS NULL OR accepted_at >= assigned_at));

-- ── Users ───────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD CONSTRAINT users_email_lower_chk   CHECK (email = lower(email));
ALTER TABLE users ADD CONSTRAINT users_avatar_color_chk  CHECK (avatar_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE users ADD CONSTRAINT users_capacity_chk      CHECK (daily_capacity >= 0);
ALTER TABLE users ADD CONSTRAINT users_team_needs_dept_chk CHECK (team_id IS NULL OR department_id IS NOT NULL);
ALTER TABLE tasks ADD CONSTRAINT tasks_team_needs_dept_chk CHECK (team_id IS NULL OR department_id IS NOT NULL);

-- ── Templates ───────────────────────────────────────────────────────────────────
ALTER TABLE task_templates ADD CONSTRAINT task_templates_sla_chk      CHECK (sla_hours IS NULL OR sla_hours BETWEEN 0 AND 2160);
ALTER TABLE task_templates ADD CONSTRAINT task_templates_estimate_chk CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);
ALTER TABLE task_templates ADD CONSTRAINT task_templates_ai_score_chk CHECK (ai_min_quality_score IS NULL OR ai_min_quality_score BETWEEN 0 AND 100);
ALTER TABLE task_templates ADD CONSTRAINT task_templates_ai_cfg_chk   CHECK (ai_first_attempt OR (ai_agent_type IS NULL AND ai_min_quality_score IS NULL AND ai_fallback_department_id IS NULL));
ALTER TABLE template_checklist_items ADD CONSTRAINT template_checklist_seq_chk CHECK (sequence_no > 0);

-- ── Checklist / comments / dependencies ─────────────────────────────────────────
ALTER TABLE task_checklist_items ADD CONSTRAINT task_checklist_seq_chk        CHECK (sequence_no > 0);
ALTER TABLE task_checklist_items ADD CONSTRAINT task_checklist_completion_chk CHECK (completed_at IS NOT NULL OR completed_by_id IS NULL);
ALTER TABLE task_comments        ADD CONSTRAINT task_comments_not_own_parent_chk CHECK (parent_comment_id IS NULL OR parent_comment_id <> id);
ALTER TABLE task_dependencies    ADD CONSTRAINT task_dependencies_no_self_chk    CHECK (task_id <> depends_on_task_id);

-- ── Files / voice / AI ──────────────────────────────────────────────────────────
ALTER TABLE task_files       ADD CONSTRAINT task_files_size_chk      CHECK (size_bytes >= 0);
ALTER TABLE task_files       ADD CONSTRAINT task_files_sha256_chk    CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE task_voice_notes ADD CONSTRAINT task_voice_duration_chk  CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
ALTER TABLE task_voice_notes ADD CONSTRAINT task_voice_comment_chk   CHECK ((purpose = 'Comment') = (comment_id IS NOT NULL));
ALTER TABLE task_ai_runs     ADD CONSTRAINT task_ai_runs_scores_chk  CHECK (
      (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
  AND (quality_score    IS NULL OR quality_score    BETWEEN 0 AND 1)
  AND (similarity_score IS NULL OR similarity_score BETWEEN 0 AND 1));
ALTER TABLE task_ai_runs     ADD CONSTRAINT task_ai_runs_io_chk      CHECK (output_file_id IS NULL OR output_file_id IS DISTINCT FROM input_file_id);

-- ── Lookups ─────────────────────────────────────────────────────────────────────
ALTER TABLE task_types           ADD CONSTRAINT task_types_code_chk  CHECK (code ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE entity_types         ADD CONSTRAINT entity_types_code_chk CHECK (code ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE business_event_types ADD CONSTRAINT event_types_code_chk CHECK (code ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE task_number_sequences ADD CONSTRAINT task_number_seq_chk CHECK (year BETWEEN 2000 AND 2999 AND last_value >= 0);

-- ── Reconciliation probe (run in CI / a nightly job; must return zero rows) ──────
-- tasks.assigned_user_id is a cached pointer to the open task_assignments row.
-- SELECT t.id, t.task_no, t.assigned_user_id, a.assignee_id
--   FROM tasks t
--   LEFT JOIN task_assignments a ON a.task_id = t.id AND a.released_at IS NULL
--  WHERE t.assigned_user_id IS DISTINCT FROM a.assignee_id;
