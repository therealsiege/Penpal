import { useState, useMemo, useEffect, useRef } from 'react'
import { Layout } from './components/Layout'
import { ToastProvider, useToast } from './components/Toast'
import { CommandPalette, type CommandAction } from './components/CommandPalette'
import { HealthModal } from './components/HealthModal'
import { SchedulerModal } from './components/SchedulerModal'
import { VenturesModal } from './components/VenturesModal'
import { BriefingModal } from './components/BriefingModal'
import { PipelineModal } from './components/PipelineModal'
import { ActivityModal } from './components/ActivityModal'
import { OrchestratorModal } from './components/OrchestratorModal'
import { CommandCenter } from './panels/CommandCenter'
import { VaultPanel } from './panels/VaultPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { SoundboardPanel } from './panels/SoundboardPanel'
import { GitHubPanel } from './panels/GitHubPanel'
import type { SystemPaths } from './types'
import { getPathPresets } from './utils/path-presets'
import { EventBus, EVENTS } from './game/events'

let veritasStartupCheckDone = false

function AppContent() {
  const [activePanel, setActivePanel] = useState('office')
  const [showHealthModal, setShowHealthModal] = useState(false)
  const [showSchedulerModal, setShowSchedulerModal] = useState(false)
  const [showVenturesModal, setShowVenturesModal] = useState(false)
  const [showBriefingModal, setShowBriefingModal] = useState(false)
  const [showPipelineModal, setShowPipelineModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showTasksModal, setShowTasksModal] = useState(false)
  const [systemPaths, setSystemPaths] = useState<SystemPaths | null>(null)
  const { toast } = useToast()
  const hasRunVeritasStartupCheck = useRef(false)

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

  useEffect(() => {
    if (veritasStartupCheckDone || hasRunVeritasStartupCheck.current) return
    veritasStartupCheckDone = true
    hasRunVeritasStartupCheck.current = true

    let cancelled = false
    ;(async () => {
      try {
        const result = await window.api.veritasStatus()
        if (cancelled) return

        if (!result || typeof result !== 'object' || !('configured' in result)) {
          return
        }

        const status = result as import('./types').VeritasServiceStatus
        if (!status.sourceDirConfigured || !status.sourceDirValid) {
          toast(
            'Veritas source path missing/invalid. Set PENNY_VERITAS_SOURCE_DIR in Penny/docker/.env.control-plane.',
            'error',
          )
        }
      } catch {
        // Keep startup resilient if Veritas status probing fails.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [toast])

  const actions = useMemo<CommandAction[]>(() => [
    // Modals / navigation
    {
      id: 'open-health',
      label: 'Open System Status',
      description: 'View infrastructure health & config',
      category: 'Navigation',
      action: () => setShowHealthModal(true),
    },
    {
      id: 'open-scheduler',
      label: 'Open Scheduler',
      description: 'View and run scheduled jobs',
      category: 'Navigation',
      action: () => setShowSchedulerModal(true),
    },
    {
      id: 'open-ventures',
      label: 'Open Vault',
      description: 'Browse vault files and send to agents',
      category: 'Navigation',
      action: () => setActivePanel('vault'),
    },
    {
      id: 'open-soundboard',
      label: 'Open Soundboard',
      description: 'Play any mp3 from Penny sound effects folder',
      category: 'Navigation',
      action: () => setActivePanel('soundboard'),
    },
    {
      id: 'open-tasks',
      label: 'Open Tasks',
      description: 'Open orchestrator and Veritas board tasks',
      category: 'Navigation',
      action: () => setShowTasksModal(true),
    },
    {
      id: 'open-briefing',
      label: 'Open Briefing',
      description: 'View daily briefing from Mission Control',
      category: 'Navigation',
      action: () => setShowBriefingModal(true),
    },
    {
      id: 'open-pipeline',
      label: 'Open Pipeline',
      description: 'View sales pipeline, hot leads, and territories',
      category: 'Navigation',
      action: () => setShowPipelineModal(true),
    },
    {
      id: 'open-activity',
      label: 'Open Activity',
      description: 'View recent job runs, new leads, and briefings',
      category: 'Navigation',
      action: () => setShowActivityModal(true),
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
      id: 'launch-frontend',
      label: 'Launch: NextJS Front End',
      category: 'Agents',
      action: async () => {
        const paths = await resolvePathPresets()
        const r = await window.api.launchAgent('nextjs-frontend', paths.onePuttWebRoot)
        toast(r.success ? 'Frontend Dev launched' : r.error || 'Failed', r.success ? 'success' : 'error')
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
        if (r.sent > 0) EventBus.emit(EVENTS.BROADCAST, msg)
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
        if (r.sent > 0) EventBus.emit(EVENTS.BROADCAST, msg)
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
        if (r.sent > 0) EventBus.emit(EVENTS.BROADCAST, msg)
      },
    },
    {
      id: 'vault-open',
      label: 'Open Vault',
      description: 'Browse and edit vault files',
      category: 'Vault',
      action: () => setActivePanel('vault'),
    },
  ], [toast, systemPaths])

  return (
    <>
      <CommandPalette actions={actions} />
      {showHealthModal && <HealthModal onClose={() => setShowHealthModal(false)} />}
      {showSchedulerModal && <SchedulerModal onClose={() => setShowSchedulerModal(false)} />}
      {showVenturesModal && <VenturesModal onClose={() => setShowVenturesModal(false)} />}
      {showBriefingModal && <BriefingModal onClose={() => setShowBriefingModal(false)} />}
      {showPipelineModal && <PipelineModal onClose={() => setShowPipelineModal(false)} />}
      {showActivityModal && <ActivityModal onClose={() => setShowActivityModal(false)} />}
      {showTasksModal && <OrchestratorModal onClose={() => setShowTasksModal(false)} />}
      <Layout
        activePanel={activePanel}
        onNavigate={setActivePanel}
        onOpenTasks={() => setShowTasksModal(true)}
      >
        {activePanel === 'office' && (
          <CommandCenter
            onOpenHealth={() => setShowHealthModal(true)}
            onOpenScheduler={() => setShowSchedulerModal(true)}
            onOpenVentures={() => setActivePanel('vault')}
            onOpenBriefing={() => setShowBriefingModal(true)}
            onOpenPipeline={() => setShowPipelineModal(true)}
            onOpenActivity={() => setShowActivityModal(true)}
            onOpenTasks={() => setShowTasksModal(true)}
          />
        )}
        {activePanel === 'vault' && <VaultPanel />}
        {activePanel === 'github' && <GitHubPanel />}
        {activePanel === 'soundboard' && <SoundboardPanel />}
        {activePanel === 'settings' && <SettingsPanel />}
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
