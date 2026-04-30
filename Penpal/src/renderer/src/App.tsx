import { useState, useMemo, useEffect } from 'react'
import { Layout } from './components/Layout'
import { ToastProvider, useToast } from './components/Toast'
import { CommandPalette, type CommandAction } from './components/CommandPalette'
import { TasksPanel } from './components/OrchestratorModal'
import { SettingsPanel } from './panels/SettingsPanel'
import { EvalsPanel } from './panels/EvalsPanel'
import { ProfilesPanel } from './panels/ProfilesPanel'
import { McpPanel } from './panels/McpPanel'
import { ReplayPanel } from './panels/ReplayPanel'
import { ResultsPanel } from './panels/ResultsPanel'
import type { SystemPaths } from './types'
import { getPathPresets } from './utils/path-presets'

function AppContent() {
  const [activePanel, setActivePanel] = useState('tasks')
  const [systemPaths, setSystemPaths] = useState<SystemPaths | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    window.api.getSystemPaths()
      .then(paths => {
        if (!cancelled) setSystemPaths(paths)
      })
      .catch(() => {
        // Keep UI functional with fallback presets if IPC fails.
      })
    return () => { cancelled = true }
  }, [])

  const resolvePathPresets = async () => {
    if (systemPaths) return getPathPresets(systemPaths)
    try {
      const paths = await window.api.getSystemPaths()
      setSystemPaths(paths)
      return getPathPresets(paths)
    } catch {
      return getPathPresets(null)
    }
  }

  const actions = useMemo<CommandAction[]>(() => [
    // Modals / navigation
    {
      id: 'open-tasks',
      label: 'Open Dispatch',
      description: 'View dispatch board',
      category: 'Navigation',
      action: () => setActivePanel('tasks'),
    },
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
      description: 'Full graph re-ingestion',
      category: 'Jobs',
      action: async () => {
        toast('Starting full ETL (this will take a while)...', 'info')
        try {
          await window.api.runJob('etl-full')
          toast('Full ETL complete', 'success')
        } catch { toast('ETL failed', 'error') }
      },
    },
    // Agents
    {
      id: 'launch-fullstack',
      label: 'Launch: Full Stack Developer',
      category: 'Agents',
      action: async () => {
        const paths = await resolvePathPresets()
        const r = await window.api.launchAgent('fullstack-dev', paths.sidekickRoot)
        toast(r.success ? 'Full Stack Dev launched' : r.error || 'Failed', r.success ? 'success' : 'error')
      },
    },
{
      id: 'launch-electron',
      label: 'Launch: Electron Developer',
      category: 'Agents',
      action: async () => {
        const paths = await resolvePathPresets()
        const r = await window.api.launchAgent('electron-dev', paths.pennyRoot)
        toast(r.success ? 'Electron Dev launched' : r.error || 'Failed', r.success ? 'success' : 'error')
      },
    },
    {
      id: 'launch-backend',
      label: 'Launch: Backend Architect',
      category: 'Agents',
      action: async () => {
        const paths = await resolvePathPresets()
        const r = await window.api.launchAgent('backend-arch', paths.analyticsRoot)
        toast(r.success ? 'Backend Architect launched' : r.error || 'Failed', r.success ? 'success' : 'error')
      },
    },
    {
      id: 'approve-all',
      label: 'Approve All Waiting',
      description: 'Allow all pending tool approvals',
      category: 'Agents',
      action: async () => {
        const r = await window.api.approveAllSessions('1')
        toast(`Approved ${r.sent} sessions`, 'success')
      },
    },
    {
      id: 'approve-all-session',
      label: 'Approve All (For Session)',
      description: 'Allow all pending tools for their sessions',
      category: 'Agents',
      action: async () => {
        const r = await window.api.approveAllSessions('2')
        toast(`Approved ${r.sent} sessions for their sessions`, 'success')
      },
    },
    {
      id: 'broadcast-status',
      label: 'Broadcast: Status Check',
      description: 'Ask all agents what they\'re working on',
      category: 'Agents',
      action: async () => {
        const msg = 'what are you working on right now? give me a one-line summary'
        const r = await window.api.broadcastToSessions(msg)
        toast(`Status check sent to ${r.sent} agents`, 'success')
      },
    },
    {
      id: 'broadcast-commit',
      label: 'Broadcast: Commit',
      description: 'Tell all agents to commit',
      category: 'Agents',
      action: async () => {
        const msg = '/commit'
        const r = await window.api.broadcastToSessions(msg)
        toast(`Commit sent to ${r.sent} agents`, 'success')
      },
    },
    {
      id: 'broadcast-pause',
      label: 'Broadcast: Pause All',
      description: 'Pause all agents',
      category: 'Agents',
      action: async () => {
        const msg = 'pause what you are doing and wait for further instructions'
        const r = await window.api.broadcastToSessions(msg)
        toast(`Pause sent to ${r.sent} agents`, 'success')
      },
    },
  ], [toast, systemPaths])

  return (
    <>
      <CommandPalette actions={actions} />
      <Layout
        activePanel={activePanel}
        onNavigate={setActivePanel}
      >
        {activePanel === 'tasks' && <TasksPanel />}
        {activePanel === 'results' && <ResultsPanel />}
        {activePanel === 'profiles' && <ProfilesPanel />}
        {activePanel === 'evals' && <EvalsPanel />}
        {activePanel === 'settings' && <SettingsPanel />}
        {activePanel === 'mcp' && <McpPanel />}
        {activePanel === 'replay' && <ReplayPanel />}
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
