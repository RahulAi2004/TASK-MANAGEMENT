import { Component } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'

// App-level error boundary so a single screen error never blanks the app.
class ErrBoundary extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div className="grid min-h-screen place-items-center bg-app p-6 text-center">
          <div className="max-w-sm">
            <div className="text-lg font-semibold text-ink">Something went wrong</div>
            <p className="mt-1 text-sm text-ink-secondary">
              This screen hit an unexpected error. Try reloading the page.
            </p>
            <button
              onClick={() => { this.setState({ err: null }); window.location.assign('/') }}
              className="mt-4 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Back to home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import Login from './routes/Login'
import Dashboard from './routes/Dashboard'
import AllTasks from './routes/AllTasks'
import Workload from './routes/Workload'
import SalesDashboard from './routes/SalesDashboard'
import Approvals from './routes/Approvals'
import DesignerQueue from './routes/DesignerQueue'
import ItTickets from './routes/ItTickets'
import TaskWorkView from './routes/TaskWorkView'
import Reports from './routes/Reports'
import Users from './routes/Users'
import Departments from './routes/Departments'
import TaskTemplates from './routes/TaskTemplates'
import Settings from './routes/Settings'

function RoleRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-app text-sm text-ink-tertiary">Loading…</div>
  }
  if (!user) return <Login />

  const home = {
    ADMIN: <Dashboard />,
    SALES: <SalesDashboard />,
    DESIGNER: <DesignerQueue />,
    IT: <ItTickets />,
  }[user.role]

  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/task/:id" element={<TaskWorkView />} />
      {/* Tasks page — all roles; the page itself limits non-admins to My Tasks */}
      <Route path="/all-tasks" element={<AllTasks />} />

      {user.role === 'ADMIN' && (
        <>
          <Route path="/workload" element={<Workload />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/templates" element={<TaskTemplates />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
        </>
      )}
      {user.role === 'SALES' && <Route path="/approvals" element={<Approvals />} />}
      {user.role === 'DESIGNER' && (
        <Route path="/submitted" element={<DesignerQueue filter="submitted" title="Submitted & Completed" />} />
      )}

      <Route path="*" element={home} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ErrBoundary>
        <RoleRoutes />
      </ErrBoundary>
    </AuthProvider>
  )
}
