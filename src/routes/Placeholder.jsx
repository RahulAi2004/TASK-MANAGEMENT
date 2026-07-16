import { Construction } from 'lucide-react'
import AppShell from '../app/AppShell'

export default function Placeholder({ title }) {
  return (
    <AppShell title={title} subtitle="Coming in a later phase">
      <div className="grid place-items-center rounded-card border border-dashed border-border-strong bg-surface py-24 text-center shadow-card">
        <Construction size={32} className="text-ink-tertiary" />
        <div className="mt-3 text-lg font-semibold text-ink">{title}</div>
        <div className="text-sm text-ink-secondary">
          This screen is specified in the technical doc and scheduled for a later phase.
        </div>
      </div>
    </AppShell>
  )
}
