import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import CreateTaskPanel from '../features/tasks/CreateTaskPanel'

export default function AppShell({ title, subtitle, children, onTasksChanged }) {
  const [createOpen, setCreateOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <Sidebar onCreate={() => setCreateOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
      <CreateTaskPanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onTasksChanged}
      />
    </div>
  )
}
