import { useState, useEffect, useMemo } from 'react'
import { Layout } from './components/Layout'
import { ToastProvider, useToast } from './components/Toast'
import { CommandPalette, type CommandAction } from './components/CommandPalette'
import { HealthPanel } from './panels/HealthPanel'
import { SchedulerPanel } from './panels/SchedulerPanel'
import { PipelinePanel } from './panels/PipelinePanel'
import { ActivityPanel } from './panels/ActivityPanel'
import { SessionsPanel } from './panels/SessionsPanel'

const PANEL_IDS = ['health', 'sessions', 'scheduler', 'pipeline', 'activity'] as const
const PANEL_LABELS: Record<string, string> = {
  health: 'Infrastructure',
  sessions: 'Claude Sessions',
  scheduler: 'Scheduler',
  pipeline: 'Sales Pipeline',
  activity: 'Activity',
}
const PANELS: Record<string, () => JSX.Element> = {
  health: HealthPanel,
  sessions: SessionsPanel,
  scheduler: SchedulerPanel,
  pipeline: PipelinePanel,
  activity: ActivityPanel,
}

function AppContent() {
  const [activePanel, setActivePanel] = useState('health')
  const { toast } = useToast()
  const Panel = PANELS[activePanel] || HealthPanel

  // Keyboard shortcuts: Cmd+1-5 to switch panels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= PANEL_IDS.length) {
        e.preventDefault()
        setActivePanel(PANEL_IDS[num - 1])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const actions = useMemo<CommandAction[]>(() => [
    // Navigation
    ...PANEL_IDS.map((id, i) => ({
      id: `nav-${id}`,
      label: `Go to ${PANEL_LABELS[id]}`,
      shortcut: `⌘${i + 1}`,
      category: 'Navigation',
      action: () => setActivePanel(id),
    })),
    // Scheduler jobs
    {
      id: 'run-health-check',
      label: 'Run Health Check',
      description: 'Check all infrastructure',
      category: 'Jobs',
      action: async () => {
        toast('Running health check...', 'info')
        try {
          await window.api.runJob('health-check')
          toast('Health check complete', 'success')
        } catch { toast('Health check failed', 'error') }
      },
    },
    {
      id: 'run-rss-ingest',
      label: 'Run RSS Ingest',
      description: 'Fetch latest articles',
      category: 'Jobs',
      action: async () => {
        toast('Starting RSS ingest...', 'info')
        try {
          await window.api.runJob('rss-ingest')
          toast('RSS ingest complete', 'success')
        } catch { toast('RSS ingest failed', 'error') }
      },
    },
    {
      id: 'run-daily-briefing',
      label: 'Generate Daily Briefing',
      description: 'Create today\'s briefing report',
      category: 'Jobs',
      action: async () => {
        toast('Generating briefing...', 'info')
        try {
          await window.api.runJob('daily-briefing')
          toast('Daily briefing generated', 'success')
        } catch { toast('Briefing generation failed', 'error') }
      },
    },
    {
      id: 'run-etl-full',
      label: 'Run Full ETL',
      description: 'Full vault re-ingestion',
      category: 'Jobs',
      action: async () => {
        toast('Starting full ETL (this will take a while)...', 'info')
        try {
          await window.api.runJob('etl-full')
          toast('Full ETL complete', 'success')
        } catch { toast('ETL failed', 'error') }
      },
    },
    // Sessions
    {
      id: 'new-session-sidekick',
      label: 'New Session: sidekick',
      category: 'Sessions',
      action: async () => {
        const r = await window.api.createNewSession('/Users/fuzeelogik/sidekick')
        toast(r.success ? 'Session launched' : r.error || 'Failed', r.success ? 'success' : 'error')
      },
    },
    {
      id: 'new-session-medscrub',
      label: 'New Session: medscrub',
      category: 'Sessions',
      action: async () => {
        const r = await window.api.createNewSession('/Users/fuzeelogik/ComSci/Workspace/1putthealth/medscrub')
        toast(r.success ? 'Session launched' : r.error || 'Failed', r.success ? 'success' : 'error')
      },
    },
    {
      id: 'new-session-1putt',
      label: 'New Session: 1putthealth.com',
      category: 'Sessions',
      action: async () => {
        const r = await window.api.createNewSession('/Users/fuzeelogik/ComSci/Workspace/1putthealth/1putthealth.com')
        toast(r.success ? 'Session launched' : r.error || 'Failed', r.success ? 'success' : 'error')
      },
    },
    {
      id: 'broadcast-status',
      label: 'Broadcast: Status Check',
      description: 'Ask all sessions what they\'re working on',
      category: 'Sessions',
      action: async () => {
        const r = await window.api.broadcastToSessions('what are you working on right now? give me a one-line summary')
        toast(`Status check sent to ${r.sent} sessions`, 'success')
      },
    },
    {
      id: 'broadcast-commit',
      label: 'Broadcast: Commit',
      description: 'Tell all sessions to commit',
      category: 'Sessions',
      action: async () => {
        const r = await window.api.broadcastToSessions('/commit')
        toast(`Commit sent to ${r.sent} sessions`, 'success')
      },
    },
    {
      id: 'broadcast-pause',
      label: 'Broadcast: Pause All',
      description: 'Pause all sessions',
      category: 'Sessions',
      action: async () => {
        const r = await window.api.broadcastToSessions('pause what you are doing and wait for further instructions')
        toast(`Pause sent to ${r.sent} sessions`, 'success')
      },
    },
  ], [toast])

  return (
    <>
      <CommandPalette actions={actions} />
      <Layout activePanel={activePanel} onNavigate={setActivePanel}>
        <Panel />
      </Layout>
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
