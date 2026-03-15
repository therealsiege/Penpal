import { useState } from 'react'
import { Layout } from './components/Layout'
import { HealthPanel } from './panels/HealthPanel'
import { SchedulerPanel } from './panels/SchedulerPanel'
import { PipelinePanel } from './panels/PipelinePanel'
import { ActivityPanel } from './panels/ActivityPanel'

const PANELS: Record<string, () => JSX.Element> = {
  health: HealthPanel,
  scheduler: SchedulerPanel,
  pipeline: PipelinePanel,
  activity: ActivityPanel,
}

export default function App() {
  const [activePanel, setActivePanel] = useState('health')
  const Panel = PANELS[activePanel] || HealthPanel

  return (
    <Layout activePanel={activePanel} onNavigate={setActivePanel}>
      <Panel />
    </Layout>
  )
}
