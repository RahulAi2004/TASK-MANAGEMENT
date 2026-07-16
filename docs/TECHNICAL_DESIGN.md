# Task Management Module — Technical & Implementation Document

**Product:** Decoinks ERP — Task Management Module
**Owner:** Technocas / Decoinks
**Version:** 1.0 (design baseline)
**Date:** 16 July 2026
**Status:** Design approved for implementation — frontend-first

---

## 0. Purpose of this document

This is the single source of truth for building the Task Management module. It covers:

- The **visual system** — we keep the enterprise ERP layouts shown in the two reference screenshots (dense dashboard + multi-section create-task form) and re-skin them with the **Microsoft To Do color palette**.
- The **data model** — the eight core tables from the module spec, plus `parent_task_id` and a dedicated `task_ai_runs` table.
- The **behavior** — task lifecycle/state machine, the four ways a task is generated, automation rules, the hybrid AI→human workflow, and the voice-notes subsystem.
- The **frontend architecture** — React 18 + Vite + Tailwind, built frontend-first against a mock data layer, with a clean seam for the real backend later.
- A phased **implementation roadmap**.

> **Scope decision (locked):** *ERP UIs, To Do colors only.* We do **not** simplify to a personal to-do app. The full ERP feature set (departments, teams, templates, QA review, AI agents, SLA, dependencies, voice) stays. Only the color palette, typography feel, and surface styling move to Microsoft To Do.

---

## 1. Product vision

A single ERP module where every unit of work — artwork extraction, background removal, mockups, production artwork, gangsheet prep, QA review, purchase-order prep, shipment monitoring — is a **task**. Tasks are created manually, automatically from business events, from AI recommendations, or as follow-ups of other tasks. Tasks flow through a controlled lifecycle with optional AI first-attempts and human review. Every state change is audited.

The interface must feel calm and legible — the **Microsoft To Do** aesthetic — while carrying enterprise density.

---

## 2. Design language — Microsoft To Do palette on ERP layouts

Microsoft To Do is built on Microsoft's **Fluent** design system: a soft near-white canvas, white cards, one confident blue accent, restrained neutrals, generous whitespace, rounded corners, and Segoe UI typography. We adopt that palette and feel; we keep the screenshot layouts.

### 2.1 Color tokens

These are the design tokens. Implement as CSS variables and mirror into `tailwind.config.js`.

#### Brand / accent (Microsoft To Do blue)

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#2564CF` | Primary actions, active nav, links, selected states, checkmarks |
| `--accent-hover` | `#1B4DAD` | Hover on primary buttons |
| `--accent-pressed` | `#16408F` | Active/pressed |
| `--accent-soft` | `#EAF1FC` | Selected-row tint, active nav background, chips |
| `--accent-soft-border` | `#C7DAF5` | Border on soft/selected surfaces |
| `--accent-gradient` | `linear-gradient(135deg,#2564CF 0%,#3B7AD9 100%)` | To Do header band, hero areas |

> The To Do app icon and default list header use a blue→lighter-blue gradient. Use `--accent-gradient` for the dashboard header band and the "My Day"-style themed strip.

#### Neutrals (Fluent neutral ramp)

| Token | Hex | Use |
|---|---|---|
| `--bg-app` | `#FAF9F8` | App canvas / page background |
| `--bg-surface` | `#FFFFFF` | Cards, panels, table surface |
| `--bg-subtle` | `#F3F2F1` | Sidebar, input fills, secondary surfaces |
| `--bg-hover` | `#F3F2F1` | Row/list hover |
| `--bg-selected` | `#EAF1FC` | Selected row (accent-soft) |
| `--border` | `#EDEBE9` | Card borders, dividers |
| `--border-strong` | `#D2D0CE` | Input borders, stronger separation |
| `--text-primary` | `#201F1E` | Titles, primary text |
| `--text-secondary` | `#605E5C` | Secondary text, labels, metadata |
| `--text-tertiary` | `#A19F9D` | Placeholders, disabled, timestamps |
| `--text-on-accent` | `#FFFFFF` | Text on accent buttons/bands |

#### Semantic / status

| Token | Hex | Use |
|---|---|---|
| `--success` | `#107C10` | Completed, approved |
| `--success-soft` | `#DFF6DD` | Completed badge bg |
| `--warning` | `#C19C00` | Waiting / On Hold |
| `--warning-soft` | `#FFF4CE` | Waiting badge bg |
| `--danger` | `#D13438` | Overdue, rejected |
| `--danger-soft` | `#FDE7E9` | Overdue badge bg |
| `--info` | `#2564CF` | In Progress, informational (reuse accent) |
| `--info-soft` | `#EAF1FC` | In Progress badge bg |
| `--priority-urgent` | `#D13438` | Urgent priority flag |
| `--priority-high` | `#E8710A` | High priority flag |
| `--priority-medium` | `#C19C00` | Medium priority flag |
| `--priority-low` | `#605E5C` | Low priority flag |

> **Migration note vs. screenshots:** the reference UI uses an indigo/purple accent (`#5B4BE6`-ish) on a light gray canvas. Everywhere the screenshots show purple — active nav pill, primary buttons, section number badges, toggles, links, chart segments — substitute `--accent` (`#2564CF`). Everything else (layout, spacing, structure) stays.

### 2.2 Status → badge mapping

| Status | Badge bg | Badge text |
|---|---|---|
| Pending | `--bg-subtle` | `--text-secondary` |
| Assigned | `--accent-soft` | `--accent` |
| Accepted | `--accent-soft` | `--accent` |
| In Progress | `--info-soft` | `--info` |
| Waiting / On Hold | `--warning-soft` | `--warning` |
| Submitted | `#F0EBFA` | `#5B4BE6` (kept violet to distinguish from In Progress) |
| Completed | `--success-soft` | `--success` |
| Rejected | `--danger-soft` | `--danger` |
| Reopened | `--warning-soft` | `--warning` |
| Cancelled | `--bg-subtle` | `--text-tertiary` |

### 2.3 Typography

- **Font family:** `"Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", Arial, sans-serif`. (Segoe UI is the native Windows font and the authentic To Do face; the fallbacks cover other OSes.)
- **Scale (Fluent-aligned):**
  - Page title / H1: 28px / 600
  - Section header (e.g. "Task Information"): 16px / 600
  - Card title: 16px / 600
  - Body: 14px / 400
  - Table cell: 14px / 400
  - Label / metadata: 12px / 400, `--text-secondary`
  - Micro (timestamps, char count): 11px / 400, `--text-tertiary`
- **Line height:** 1.4 body, 1.25 headings.

### 2.4 Shape, elevation, spacing

- **Corner radius:** cards/panels `8px`; inputs/buttons `6px`; chips/badges `4px`; avatars/circular-check fully round.
- **Elevation:** cards use border `1px solid --border` + soft shadow `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)`. Slide-over/modal: `0 8px 24px rgba(0,0,0,.12)`.
- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32. Card padding 20–24. Section gap 24. Form field vertical gap 16.
- **Focus ring:** `0 0 0 2px #FFFFFF, 0 0 0 4px --accent` (Fluent-style dual ring) for keyboard focus.
- **Circular check control** (To Do signature): 20px circle, `1.5px` border `--border-strong`; on complete, fill `--accent` with a white check; hover shows a faint check.

### 2.5 Motion

- 100–150ms ease for hover/press; 200–250ms ease-out for slide-over enter; respect `prefers-reduced-motion`.

---

## 3. Information architecture & navigation

Two sidebars appear in the screenshots (an app-wide ERP nav and a module-scoped nav). We implement the **module-scoped Task Management sidebar** as the primary nav for this module, matching screenshot 2:

```
Task Management (module header)
├── Dashboard            ← default landing
├── My Tasks
├── All Tasks
├── Create Task          ← opens slide-over, not a full route
├── Task Templates
├── Reports
├── Workload
├── Departments
├── Users
└── Settings

Quick Actions (pinned bottom): [ + New Task ]  [ ⭱ Import Tasks ]
```

- Active item: `--accent-soft` background pill, `--accent` icon + label, left accent bar optional.
- Top bar: page title + subtitle (left), date selector, global search, notifications (badge count), help, user menu (right) — as in screenshot 2.

---

## 4. Screen specifications

Each screen keeps the reference layout; only palette/typography change. Refs: **SC1 = Create New Task**, **SC2 = Task Dashboard**.

### 4.1 Dashboard (SC2)

**Stat cards row** (6): Assigned to Me, In Progress, Waiting / On Hold, Submitted, Completed Today, Overdue. Each card = round tinted icon + count + label. Icon tints use status tokens (accent, info, warning, submitted-violet, success, danger).

**My Tasks panel:** tab strip (Assigned / In Progress / Waiting / Submitted with counts), search field, filter dropdowns (Priority, Due Date, Task Type, Entity), and a table:

| Col | Content |
|---|---|
| Task No | `TASK-2026-000125` (link, `--accent`) |
| Task Title | title + one-line subtitle (`--text-secondary`) |
| Entity | entity chip (module + record no) |
| Priority | priority flag + label |
| Due Date | date + time, red when overdue |
| Status | status badge (§2.2) |
| Action | primary **Start** button; kebab menu |

Footer: "Showing 1 to N of M" + "View All Tasks".

**Right rail:**
- **My Current Task** card: title, subtitle, entity, Started At / Time Running (live timer) / Due Date, **Pause** + **Submit Task** buttons.
- **Task Status Overview** donut: segments = Assigned/In Progress/Waiting/Submitted/Completed/Overdue using status colors; center shows total.

**Bottom row:** Overdue Tasks list, Upcoming Deadlines (next 7 days), Activity Feed (icon + text + relative time).

### 4.2 My Tasks / All Tasks (list view)

Full-width version of the My Tasks table with persistent filters, saved views, sort, pagination, bulk selection (checkbox column), and column visibility. `My Tasks` pre-filters to `assigned_user_id = current user`; `All Tasks` shows everything the user is permitted to see.

### 4.3 Create New Task — slide-over panel (SC1)

Per spec, this is **one slide-over panel/modal**, not a separate page. Two-column body inside the panel; seven numbered sections with circular number badges (`--accent`). Header actions: **Cancel**, **Save as Draft**, **Create Task**. Advanced sections collapsible; a "simple mode" shows only Cancel + Create Task.

**Section 1 — Task Information:** Task Title\*, Task Type\*, Priority\*, Related Module\*, Related Record\* (searchable selector, e.g. `AW-2026-000125 – Marine Family Logo`), Parent Task (optional → sets `parent_task_id`), Description (textarea, live `n/1000` char count).

**Section 2 — Assignment:** Department\*, Team, Assign To\* (user picker w/ avatar), Assigned By (read-only = creator), **Requires Acceptance** (toggle), Reviewer (for approval). Assignee **recommendation** engine (later): ranks by department, skill, current workload, shift availability, prior related work, priority, deadline — creator may override.

**Section 3 — Schedule & SLA:** Start After, Due Date & Time\*, Estimated Time (mins), SLA Template, Reminder (e.g. "30 minutes before due").

**Section 4 — Checklist (optional):** rows of `# | Checklist Item | Required | Default` with add/remove; maps to `task_checklists`.

**Section 5 — Instructions:** Written Instructions (rich text: bold/italic/underline/lists/link). Voice Instructions (optional): **Record Voice** / upload audio; after capture show player + duration + optional "Generate transcript" + language; maps to `task_voice_notes` type `Instruction`.

**Section 6 — Attachments & References:** drag-and-drop upload (PNG/JPG/PDF/AI/PSD ≤100MB), file list with size + remove, Reference Artwork Version selector (e.g. `AW-2026-000125-V0 (Original)`) with preview.

**Section 7 — Automation & AI (optional):** **AI First Attempt** toggle, AI Agent select (e.g. "Background Removal Agent"), Min Quality Score % (e.g. 95), "If below score, assign to" (dept/team). Maps to template AI fields + `task_ai_runs` at runtime.

**Create options:** Save as Draft · Create Task · Create and Start · Create Recurring Task (advanced).

### 4.4 Task Working view

Opened when a user opens a task.

- **Header:** task no, title, status, priority, due date, related entity, assigned user, **Start / Pause / Submit** buttons + timer.
- **Tabs:** Details · Instructions · Comments · Checklist · Files · Activity · Dependencies.
- **Voice Instructions:** playable waveform + recorded-by, time, duration, transcript, permissioned download/open.
- **Work Actions (entity-specific):**
  - Artwork task: Open Artwork · Open Design Studio · View Customer Reference · Add Version · Upload Result.
  - Gangsheet task: Open Gangsheet Builder · View Order Items · Generate Gangsheet · Upload RIP Files.
- **Start behavior (three methods):** (1) click **Start Task** → `status=In Progress`, `started_at=now`, write `task_activity`; (2) "Open in Design Studio" → confirm → auto-start; (3) AI agent starts → `performed_by_type=AI`, agent name, progress, retry count.

### 4.5 Submission panel

Triggered by **Submit Task**. Required/optional fields per template:

| Field | Requirement |
|---|---|
| Completion Summary | Optional or mandatory by template |
| Voice Submission | Optional (`task_voice_notes` type `Submission`) |
| Output Files | Required when the task produces a file |
| Checklist | All required items must be completed |
| Result Version | Required for artwork tasks |
| Notes for Reviewer | Optional |
| Time Spent | Auto-calculated, editable if allowed |

On submit → `status=Submitted`, `submitted_at=now`. If review required, task is **not** Completed until a reviewer approves.

### 4.6 Secondary screens

- **Task Templates:** CRUD over `task_templates` (trigger event → generated task).
- **Reports:** throughput, cycle time, SLA adherence, AI-vs-human, rejection rate.
- **Workload:** per-user/team open tasks, capacity, overdue risk (feeds the recommendation engine).
- **Departments / Users / Settings:** reference data + module config (statuses, SLA defaults, AI thresholds).

---

## 5. Data model

Postgres. UUID primary keys; human-readable numbers alongside. All timestamps `TIMESTAMPTZ`. Soft delete via `deleted_at` where noted. All status changes must write `task_activity`.

### 5.1 Entity list

`task_master`, `task_assignment_history`, `task_voice_notes`, `task_comments`, `task_checklists`, `task_dependencies`, `task_activity`, `task_templates`, **`task_ai_runs`** (added).

### 5.2 `task_master`

Current task state + current assignment (history lives in `task_assignment_history`).

| Field | Type | Key | Null | Notes |
|---|---|---|---|---|
| id | UUID | PK | No | |
| task_no | VARCHAR(30) | Unique | No | `TASK-2026-000001` |
| title | VARCHAR(255) | | No | |
| description | TEXT | | Yes | Written instructions |
| entity_type | VARCHAR(40) | | No | e.g. Artwork |
| entity_id | UUID | | No | Related record |
| entity_subtype | VARCHAR(40) | | Yes | e.g. Production Version |
| module_name | VARCHAR(40) | | No | Source module |
| task_type | VARCHAR(50) | | No | e.g. Production Artwork |
| **parent_task_id** | UUID | FK → task_master.id | Yes | Follow-up / subtask link |
| department_id | UUID | FK → departments.id | Yes | |
| assigned_user_id | UUID | FK → users.id | Yes | **Current owner only** |
| assigned_team_id | UUID | FK → teams.id | Yes | |
| assigned_by | UUID | FK → users.id | Yes | |
| priority | VARCHAR(20) | | No | Low/Medium/High/Urgent |
| status | VARCHAR(30) | | No | §6 states |
| requires_acceptance | BOOLEAN | | No | default false |
| requires_review | BOOLEAN | | No | default false |
| reviewer_user_id | UUID | FK → users.id | Yes | |
| start_after | TIMESTAMPTZ | | Yes | Earliest start |
| due_at | TIMESTAMPTZ | | Yes | |
| estimated_minutes | INTEGER | | Yes | |
| started_at | TIMESTAMPTZ | | Yes | |
| submitted_at | TIMESTAMPTZ | | Yes | |
| completed_at | TIMESTAMPTZ | | Yes | |
| completion_summary | TEXT | | Yes | |
| performed_by_type | VARCHAR(10) | | Yes | `User` or `AI` |
| template_id | UUID | FK → task_templates.id | Yes | If generated |
| created_by | UUID | FK → users.id | No | |
| created_at | TIMESTAMPTZ | | No | |
| updated_at | TIMESTAMPTZ | | No | |
| deleted_at | TIMESTAMPTZ | | Yes | Soft delete |

> Added beyond the source spec: `parent_task_id` (required by "Task created from another task"), `requires_acceptance`, `requires_review`, `reviewer_user_id`, `performed_by_type`, `template_id` — all implied by the workflow narrative.

### 5.3 `task_assignment_history`

Every assignment/reassignment. `id, task_id→task_master, previous_user_id, assigned_user_id, assigned_team_id, assigned_by, assignment_reason, assigned_at, accepted_at, released_at`.

### 5.4 `task_voice_notes`

Metadata only; audio lives in file storage.

`id (PK), task_id (FK), voice_note_type {Instruction|Submission|Comment|Review Feedback}, asset_id (FK→stored file), recorded_by (FK→users), duration_seconds, mime_type, transcript, transcript_status {Pending|Processing|Completed|Failed|Not Requested}, language_code, is_primary BOOLEAN, created_at, deleted_at`.

Rules: multiple notes per task; normally one `is_primary=TRUE` per (task, type); transcription runs async and must never block create/submit; original audio is the source of truth; soft-delete + retention (deleting a task must not immediately hard-delete audio).

### 5.5 `task_comments`

`id, task_id, comment_type {Comment|Question|Answer|Feedback}, comment_text, parent_comment_id (threaded), commented_by, created_at, updated_at, deleted_at`. Voice comments reference `task_voice_notes` — never store binary here.

### 5.6 `task_checklists`

`id, task_id, sequence_no, checklist_item, is_required BOOLEAN, is_completed BOOLEAN, completed_by, completed_at, notes`.

### 5.7 `task_dependencies`

`id, task_id (dependent), depends_on_task_id (predecessor), dependency_type {Finish-to-Start|Start-to-Start|Finish-to-Finish}, is_mandatory BOOLEAN, created_at`. A task cannot enter **In Progress** until mandatory dependencies are satisfied.

### 5.8 `task_activity`

Full audit trail. `id, task_id, activity_type {Created|Assigned|Started|Submitted|Approved|Rejected|Reopened|...}, old_status, new_status, performed_by, notes, metadata JSONB, created_at`.

### 5.9 `task_templates`

Defines auto-generated tasks. `id, template_code (unique), template_name, source_module, entity_type, trigger_event {artwork_created|payment_received|qa_rejected|...}, task_type, default_title, default_description, default_department_id, default_priority, estimated_minutes, requires_acceptance, requires_submission, instruction_voice_allowed, submission_voice_allowed, is_active, created_at, updated_at`.

> **AI extension fields** (added to templates): `ai_first_attempt BOOLEAN, ai_agent_type VARCHAR(50), ai_min_quality_score INT, ai_fallback_department_id UUID` — drive Section 7 of Create Task and the hybrid workflow.

### 5.10 `task_ai_runs` (new — separate table)

A task may have several AI attempts before a human takes over.

`id (PK), task_id (FK), agent_type {Artwork Analyzer|Background Remover|Mockup Generator|...}, model_name, run_status {Queued|Running|Completed|Failed}, input_version_id, output_version_id, confidence_score, quality_score, similarity_score, started_at, completed_at, error_message, result_summary, metadata JSONB`.

### 5.11 Key relationships

```
task_master 1─* task_assignment_history
task_master 1─* task_voice_notes
task_master 1─* task_comments (self-threaded via parent_comment_id)
task_master 1─* task_checklists
task_master 1─* task_dependencies (self-ref via depends_on_task_id)
task_master 1─* task_activity
task_master 1─* task_ai_runs
task_master *─1 task_templates (template_id)
task_master *─1 task_master (parent_task_id, self-ref)
```

---

## 6. Task lifecycle & state machine

**Primary path:** `Pending → Assigned → Accepted → In Progress → Submitted → Completed`

**Exception states:** `Waiting`, `On Hold`, `Rejected`, `Reopened`, `Cancelled`.

### 6.1 State definitions

- **Pending** — exists but unassigned, or a mandatory dependency is incomplete.
- **Assigned** — user/team assigned (records assigned user, team, by, time).
- **Accepted** — assignee confirms responsibility. Skippable when `requires_acceptance=false`.
- **In Progress** — via Start button / open-in-tool / AI agent (§4.4). Sets `started_at`.
- **Waiting / On Hold** — blocked (dependency, external input).
- **Submitted** — assignee submitted; awaiting review when `requires_review=true`.
- **Completed** — reviewer approved (or auto-complete when no review).
- **Rejected** — reviewer rejected; can be **Reopened** and reassigned, preserving all comments/voice/submissions/activity.
- **Cancelled** — terminal, work abandoned.

### 6.2 Transition rules (guards)

| From | Event | To | Guard / effect |
|---|---|---|---|
| Pending | assign | Assigned | writes assignment_history |
| Assigned | accept | Accepted | if requires_acceptance; else auto |
| Assigned/Accepted | start | In Progress | mandatory deps satisfied; set started_at; activity |
| In Progress | hold | On Hold | reason recorded |
| On Hold/Waiting | resume | In Progress | |
| In Progress | submit | Submitted | required checklist complete, output files present; set submitted_at |
| Submitted | approve | Completed | reviewer only; set completed_at |
| Submitted | reject | Rejected | reviewer only; feedback (text/voice) |
| Rejected | reopen | Reopened→Assigned | preserve history |
| any (non-terminal) | cancel | Cancelled | permissioned |

**Invariant:** every transition writes a `task_activity` row with `old_status`/`new_status`.

---

## 7. Task generation — four methods

1. **Manual** — user clicks New Task, fills the slide-over. System creates `task_master` + initial `task_assignment_history` + initial `task_activity` (+ optional voice notes, checklist rows, dependencies).
2. **Automatic (business event → template)** — event fires (e.g. *Sales Order Confirmed*), matching `task_templates` row is evaluated, task created and routed to the department (e.g. *Create Production Artwork Task → Design*). See §8.
3. **AI-recommended** — an AI agent detects required work (e.g. low resolution + visible background → recommend *Reconstruct* / *Remove Background*). **Default policy: human confirmation** before creation, unless a rule marks it low-risk/fully-automated.
4. **From another task** — follow-up/subtask; new task links back via `parent_task_id`; original stays in history.

---

## 8. Automation rules (trigger → auto-created task)

Generated from `task_templates`. Automation = the system creating/moving tasks by business rules; it does **not** imply AI does the work.

| Trigger event | Auto-created task |
|---|---|
| Artwork uploaded | Artwork Review |
| Artwork requires preparation | Background Removal / Reconstruction |
| Customer mockup requested | Mockup Creation |
| Customer requests changes | Artwork Revision |
| Payment received | Production Artwork |
| Production artwork submitted | Artwork QA |
| Artwork QA approved | Gangsheet Preparation |
| Gangsheet submitted | Gangsheet QA |
| QA rejected | Artwork / Gangsheet Fix |
| Gangsheet QA approved | Purchase Order Preparation |
| Purchase Order issued | Supplier Confirmation Follow-up |
| Shipment tracking added | Shipment Monitoring |

**Automation categories:**
- *Fully automatic:* task creation, assignment recommendation, notifications, due-date calc, dependency activation, voice transcription, AI analysis, simple file conversion.
- *AI-assisted + human approval:* background removal, enhancement, reconstruction, aspect-ratio change, mockup generation, gangsheet optimization.
- *Human-only authority:* customer intent confirmation, final artwork approval, QA approval, gangsheet approval, PO issuance, supplier selection.

---

## 9. AI agent integration & hybrid workflow

**Suitable for AI first attempt:** artwork analysis (detect background/transparency/low-res/DPI/halos/stray pixels/jagged edges/aspect issues), image processing (bg removal, upscaling, basic reconstruction, aspect conversion, enhancement, simple cleanup, basic mockup, format conversion), operational assistance (task summaries, voice transcription, requirement extraction, assignee/checklist recommendation, overdue-risk detection, QA submission summary, version comparison).

**Human-controlled (AI may assist, never final):** unclear customer intent (Sales), customer-facing mockup approval (Sales/Customer), complex reconstruction & typography & final production artwork (Designer), final artwork/gangsheet QA (QA), PO issuance & supplier selection (Procurement), customer approval (Sales), trademark/copyright judgment (authorized staff).

**Hybrid flow:**

```
Task Created → AI First Attempt → Automated Validation → Score ≥ threshold?
  Yes → AI output saved as NEW version → human quick review → approve & complete
  No  → AI output + analysis preserved → assign to designer → designer continues from AI result
```

**Hard rule:** AI output always creates a **new artwork version** and never overwrites the input. Each attempt = one `task_ai_runs` row (multiple attempts possible before a human takes over).

---

## 10. Voice-notes subsystem

- Recording UI on Create (instruction), Submit (submission), Comments, and QA (review feedback).
- Store audio in central file storage; DB keeps `asset_id` + metadata only.
- Transcription is **async** and optional; failure must not block create/submit; original audio is source of truth.
- Soft delete + retention: deleting a task must not immediately hard-delete audio.
- One `is_primary=TRUE` per (task, voice_note_type).

---

## 11. Numbering & IDs

- `task_no`: `TASK-<year>-<6-digit sequence>` (e.g. `TASK-2026-000125`). Year-scoped monotonic sequence.
- Entity records referenced as-is (`AW-2026-000125`, `SO-2026-000345`, `LD-2026-000487`).
- Internal keys are UUIDs; human numbers are display/lookup only.

---

## 12. Frontend architecture (React 18 + Vite + Tailwind)

Frontend-first: build the full UI against a **mock data layer** with a repository interface, so swapping to the real API later is a one-file change per resource.

### 12.1 Stack

- React 18 + Vite, JavaScript (JSX).
- Tailwind CSS with the §2 tokens wired into `tailwind.config.js` (colors, radius, shadow, font).
- Routing: React Router.
- Data/state: TanStack Query over a repository layer (mock now, HTTP later); lightweight UI state with Zustand or context.
- Forms: React Hook Form + Zod schemas (mirror the DB constraints).
- Charts: Recharts (donut on dashboard) or lightweight SVG.
- Icons: Lucide (Fluent-like line icons).
- Dates: date-fns.

### 12.2 Folder structure

```
task-management/
├── docs/
│   └── TECHNICAL_DESIGN.md         ← this file
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx                     ← routes + AppShell
    ├── theme/
    │   ├── tokens.css              ← CSS variables (§2.1)
    │   └── index.js
    ├── app/
    │   ├── AppShell.jsx            ← sidebar + top bar
    │   ├── Sidebar.jsx
    │   └── TopBar.jsx
    ├── routes/
    │   ├── Dashboard.jsx
    │   ├── MyTasks.jsx
    │   ├── AllTasks.jsx
    │   ├── TaskTemplates.jsx
    │   ├── Workload.jsx
    │   └── Reports.jsx
    ├── features/
    │   ├── tasks/
    │   │   ├── CreateTaskPanel.jsx        ← slide-over, 7 sections
    │   │   ├── sections/                  ← one component per section
    │   │   ├── TaskWorkingView.jsx
    │   │   ├── SubmitTaskPanel.jsx
    │   │   ├── TaskTable.jsx
    │   │   ├── StatusBadge.jsx
    │   │   ├── PriorityFlag.jsx
    │   │   └── useTasks.js
    │   ├── dashboard/  (StatCards, StatusDonut, ActivityFeed, ...)
    │   ├── voice/      (VoiceRecorder, VoicePlayer, waveform)
    │   ├── checklist/  (ChecklistEditor, ChecklistRunner)
    │   └── ai/         (AiRunPanel, AiFirstAttemptToggle)
    ├── components/                 ← Button, Input, Select, Toggle, Modal,
    │   │                              SlideOver, Tabs, Avatar, Chip, Card, Table...
    ├── data/
    │   ├── repository.js           ← interface (getTasks, createTask, ...)
    │   ├── mock/
    │   │   ├── tasks.js  templates.js  users.js  activity.js
    │   └── http/                   ← real API impl (later)
    └── lib/  (formatDate, taskStateMachine.js, numbering.js, permissions.js)
```

### 12.3 Component-to-spec mapping

- `taskStateMachine.js` implements §6 transitions + guards (single source of truth; UI buttons ask it what's allowed).
- `StatusBadge` / `PriorityFlag` read §2.2 / priority tokens.
- `CreateTaskPanel` renders sections 1–7 (§4.3); Zod schema mirrors `task_master` + related rows.
- `VoiceRecorder` uses MediaRecorder → produces a blob + duration; mock repo stores an object URL; transcript status stubbed as `Not Requested`.
- Mock repo seeds the exact sample tasks from the spec (TASK-2026-000118…000125) so the dashboard matches the screenshots on first run.

### 12.4 The repository seam

```
// data/repository.js
export const repository = import.meta.env.VITE_USE_API
  ? httpRepository   // data/http/*
  : mockRepository;  // data/mock/*
```

All features call `repository.*`; nothing imports mock data directly. Backend swap = implement `http/` against §13.

---

## 13. API surface (future backend contract)

REST, resource-per-table. Illustrative:

```
GET    /api/tasks?assignee=&status=&priority=&entity=&q=&page=
POST   /api/tasks                      # create (manual)
GET    /api/tasks/:id
PATCH  /api/tasks/:id                  # edit fields
POST   /api/tasks/:id/transitions      # {event: start|submit|approve|reject|...}
POST   /api/tasks/:id/assignments      # reassign
GET    /api/tasks/:id/activity
POST   /api/tasks/:id/comments
GET/POST/PATCH /api/tasks/:id/checklist
POST   /api/tasks/:id/voice-notes      # upload metadata; audio → file service
POST   /api/tasks/:id/ai-runs          # trigger/record AI attempt
GET    /api/templates                  # CRUD
POST   /api/events                     # business event → template evaluation (automation)
GET    /api/workload                   # capacity per user/team
```

Transitions endpoint enforces the §6 state machine server-side (client mirrors it for UX only). Business events (`/api/events`) drive §8 automation.

---

## 14. Roles & permissions (baseline)

| Role | Can |
|---|---|
| Sales | create tasks, confirm customer intent, approve customer-facing mockups |
| Designer | perform design/artwork tasks, add versions, submit |
| QA | review submissions, approve/reject, final QA authority |
| Procurement | PO issuance, supplier selection, related tasks |
| Manager | reassign, override recommendations, cancel, view reports |
| AI Agent (system) | first-attempt on eligible tasks; never final approval |

Permission checks gate transition events and work actions; `permissions.js` centralizes them.

---

## 15. Implementation roadmap

**Phase 0 — Scaffold & design system (foundation)**
Vite + React + Tailwind; wire §2 tokens; base components (Button, Input, Select, Toggle, Card, Table, Tabs, SlideOver, Modal, Avatar, Chip, StatusBadge, PriorityFlag); AppShell (Sidebar + TopBar) in To Do palette.

**Phase 1 — Dashboard (SC2)**
Stat cards, My Tasks table with tabs/filters/search, My Current Task card + live timer, Status donut, Overdue/Upcoming/Activity panels. Mock repo seeded with sample tasks.

**Phase 2 — Create Task slide-over (SC1)**
Sections 1–7, RHF + Zod validation, simple/advanced modes, Save as Draft / Create / Create and Start. Checklist editor. Attachment stubs.

**Phase 3 — Task Working view + state machine**
Header + tabs (Details/Instructions/Comments/Checklist/Files/Activity/Dependencies), Start/Pause/Submit wired to `taskStateMachine`, activity log rendering, entity-specific work actions.

**Phase 4 — Submission + review**
Submit panel (required checklist/output/version guards), reviewer approve/reject, reopen flow preserving history.

**Phase 5 — Voice notes**
Recorder + player + waveform; instruction/submission/comment/review-feedback types; async transcript status UI (stubbed).

**Phase 6 — Templates & automation (UI)**
Template CRUD; event→task simulator in mock repo to demonstrate §8 rules.

**Phase 7 — AI first-attempt (UI)**
`task_ai_runs` panel, AI First Attempt toggle + threshold + fallback, hybrid approve/reassign UX (mocked scores).

**Phase 8 — Reports & Workload**
Throughput, cycle time, SLA, rejection rate; workload/capacity view feeding recommendations.

**Phase 9 — Backend integration**
Implement `data/http/*` against §13; replace mock repo via the `VITE_USE_API` seam; server-side state machine + automation engine + file/transcription services.

---

## 16. Assumptions & open questions

**Assumptions**
- Frontend-first with mock data; backend/DB deferred to Phase 9 (per stack decision).
- "ERP UIs, To Do colors only": layouts from SC1/SC2 are authoritative; palette from §2 is authoritative; where they conflict, palette wins.
- Segoe UI is available on the target (Windows) environment; fallbacks cover others.
- Submitted keeps a distinct violet badge to stay visually separable from In Progress (blue).

**Open questions**
1. Recurring tasks — full RRULE support or fixed presets (daily/weekly)?
2. SLA templates — exact escalation rules and breach behavior?
3. Assignee recommendation — heuristic in Phase 8, or ML later? What signals are available now?
4. File storage & transcription provider (for Phase 9)?
5. Real-time updates (activity feed, timers) — polling vs. WebSocket?
6. Multi-tenant / multi-org, or single Decoinks instance?

---

*End of document.*
