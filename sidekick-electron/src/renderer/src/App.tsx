import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { HealthPanel } from './panels/HealthPanel'
import { SchedulerPanel } from './panels/SchedulerPanel'
import { PipelinePanel } from './panels/PipelinePanel'
import { ActivityPanel } from './panels/ActivityPanel'
import { SessionsPanel } from './panels/SessionsPanel'

const PANEL_IDS = ['health', 'sessions', 'scheduler', 'pipeline', 'activity'] as const
const PANELS: Record<string, () => JSX.Element> = {
  health: HealthPanel,
  sessions: SessionsPanel,
  scheduler: SchedulerPanel,
  pipeline: PipelinePanel,
  activity: ActivityPanel,
}

export default function App() {
  const [activePanel, setActivePanel] = useState('health')
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

  return (
    <Layout activePanel={activePanel} onNavigate={setActivePanel}>
      <Panel />
    </Layout>
  )
}
