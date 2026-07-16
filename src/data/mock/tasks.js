// Seed tasks mirroring the reference dashboard screenshot (TASK-2026-00108…00125).
// Fields follow task_master from docs/TECHNICAL_DESIGN.md §5.2.
export const tasks = [
  {
    task_no: 'TASK-2026-00125',
    title: 'Background Removal',
    subtitle: 'Remove white background',
    entity_type: 'Artwork',
    entity_id: 'AW-2026-000125',
    task_type: 'Background Removal',
    priority: 'High',
    status: 'Assigned',
    assigned_user_id: 'USR-0001',
    due_at: '2026-07-15T15:00:00',
    started_at: '2026-07-15T10:15:00',
    estimated_minutes: 45,
  },
  {
    task_no: 'TASK-2026-00124',
    title: 'Customer Mockup',
    subtitle: 'Generate mockups',
    entity_type: 'Artwork',
    entity_id: 'AW-2026-000125',
    task_type: 'Mockup Creation',
    priority: 'High',
    status: 'Assigned',
    assigned_user_id: 'USR-0001',
    due_at: '2026-07-15T17:00:00',
    estimated_minutes: 30,
  },
  {
    task_no: 'TASK-2026-00121',
    title: 'Extract Artwork',
    subtitle: 'Extract main design',
    entity_type: 'Artwork',
    entity_id: 'AW-2026-000123',
    task_type: 'Artwork Extraction',
    priority: 'Medium',
    status: 'Assigned',
    assigned_user_id: 'USR-0010',
    due_at: '2026-07-16T11:00:00',
    estimated_minutes: 40,
  },
  {
    task_no: 'TASK-2026-00119',
    title: 'Customer Approval Follow-up',
    subtitle: 'Follow up for approval',
    entity_type: 'Lead',
    entity_id: 'LD-2026-000487',
    task_type: 'Follow-up',
    priority: 'Medium',
    status: 'Assigned',
    assigned_user_id: 'USR-0001',
    due_at: '2026-07-16T16:00:00',
    estimated_minutes: 15,
  },
  {
    task_no: 'TASK-2026-00118',
    title: 'Prepare Production Artwork',
    subtitle: '300 DPI, transparent BG',
    entity_type: 'Sales Order',
    entity_id: 'SO-2026-000345',
    task_type: 'Production Artwork',
    priority: 'High',
    status: 'Assigned',
    assigned_user_id: 'USR-0021',
    due_at: '2026-07-17T10:00:00',
    estimated_minutes: 60,
  },
  {
    task_no: 'TASK-2026-00115',
    title: 'Gangsheet Generation',
    subtitle: 'Nest designs on sheet',
    entity_type: 'Sales Order',
    entity_id: 'SO-2026-000340',
    task_type: 'Gangsheet Preparation',
    priority: 'High',
    status: 'Overdue',
    assigned_user_id: 'USR-0010',
    due_at: '2026-07-14T14:00:00',
    estimated_minutes: 50,
  },
  {
    task_no: 'TASK-2026-00108',
    title: 'QA Review',
    subtitle: 'Check quality and specs',
    entity_type: 'Artwork',
    entity_id: 'AW-2026-000120',
    task_type: 'QA Review',
    priority: 'High',
    status: 'Overdue',
    assigned_user_id: 'USR-0030',
    due_at: '2026-07-13T11:00:00',
    estimated_minutes: 25,
  },
]

// Dashboard stat tallies (from screenshot).
export const stats = {
  assignedToMe: 8,
  inProgress: 2,
  waiting: 1,
  submitted: 3,
  completedToday: 11,
  overdue: 2,
}

// Task Status Overview donut segments.
export const statusOverview = [
  { label: 'Assigned', value: 8, color: '#2564CF' },
  { label: 'In Progress', value: 2, color: '#3B7AD9' },
  { label: 'Waiting / On Hold', value: 1, color: '#C19C00' },
  { label: 'Submitted', value: 3, color: '#5B4BE6' },
  { label: 'Completed', value: 11, color: '#107C10' },
  { label: 'Overdue', value: 2, color: '#D13438' },
]

export const upcoming = [
  { date: '16 Jul 2026', time: '11:00 AM', title: 'Extract Artwork', entity: 'AW-2026-000123', priority: 'Medium', status: 'Assigned' },
  { date: '16 Jul 2026', time: '04:00 PM', title: 'Customer Approval Follow-up', entity: 'LD-2026-000487', priority: 'Medium', status: 'Assigned' },
  { date: '17 Jul 2026', time: '10:00 AM', title: 'Prepare Production Artwork', entity: 'SO-2026-000345', priority: 'High', status: 'Assigned' },
]

export const activity = [
  { type: 'completed', text: 'Task TASK-2026-00110 has been completed', by: 'Hassan Raza', time: '10 min ago' },
  { type: 'submitted', text: 'Task TASK-2026-00117 submitted for review', by: 'Areeba Khan', time: '25 min ago' },
  { type: 'waiting', text: 'Task TASK-2026-00112 is waiting for approval', by: 'Bilal Ahmed', time: '1 hr ago' },
  { type: 'rejected', text: 'Task TASK-2026-00109 was rejected', by: 'QA User 01', time: '2 hrs ago' },
]
