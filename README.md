# Decoinks ERP — Task Management

Role-based task management: **Admin → Sales Agent → Designer** delegation chain,
plus IT tickets. Microsoft To Do look (Fluent palette, `#2564CF` accent) on
enterprise layouts.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Router |
| Backend | Node.js + Express (REST) |
| ORM / DB | Prisma — SQLite in dev, switch `provider` to `postgresql` for production |
| Auth | JWT (12h) + bcrypt; role-based access enforced server-side |

## Run locally

```bash
# 1. API (port 4100)
cd server
npm install
npx prisma migrate dev   # creates dev.db + runs seed
npm run dev

# 2. Frontend (port 5180, proxies /api → 4100)
cd ..
npm install
npm run dev
```

Open http://localhost:5180 and pick a workspace:

| User | Login | Portal |
|---|---|---|
| Bilal Ahmed | `bilal@decoinks.com` / `Admin@123` | Admin — sees ALL tasks, assigns to anyone (incl. IT), workload board |
| Areeba Khan | `areeba@decoinks.com` / `Sales@123` | Sales — my tasks + delegate to designers + approvals |
| Hassan Raza | `hassan@decoinks.com` / `Design@123` | Designer — execution queue + focus view |
| Usman Tariq | `usman@decoinks.com` / `It@123` | IT — ticket queue with SLA countdown |

## Access rules (enforced by the API)

- **Admin**: sees every task; can assign to any role; approve/reject anything.
- **Sales**: sees only own + delegated tasks; can assign **designers only**; reviews their submissions.
- **Designer / IT**: see only their own tasks; cannot create tasks for others.
- Reviewer of a task = its creator (or Admin).
- Submit is blocked until all required checklist items are complete.
- Every status change writes a `task_activity` audit row.

## Layout

```
├── docs/TECHNICAL_DESIGN.md    full design + data model + roadmap
├── Decoinks ERP Portals.dc.html  visual spec (Claude Designs export)
├── server/                     Express + Prisma API
│   ├── prisma/schema.prisma    9 models (Task, User, Activity, AiRun, …)
│   ├── prisma/seed.js          4 users + tasks proving every delegation path
│   └── src/                    routes (auth/users/tasks) + state machine + RBAC
└── src/                        React app
    ├── auth/                   AuthContext, useApi
    ├── app/                    role-aware shell (Sidebar/TopBar)
    ├── routes/                 Login, Dashboard(admin), SalesDashboard,
    │                           Approvals, DesignerQueue, ItTickets,
    │                           TaskWorkView, AllTasks, Workload
    └── features/tasks/         TaskTable, badges, CreateTaskPanel
```
