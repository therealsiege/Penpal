/// <reference types="vite/client" />

import type {
  HealthResult,
  JobStatus,
  JobRun,
  StageSummary,
  HotLead,
  TerritoryData,
  NewLead,
  ClaudeSession,
  GraphStats,
} from './types'

declare global {
  interface Window {
    api: {
      getHealth: () => Promise<HealthResult>
      getSchedulerStatus: () => Promise<JobStatus[]>
      getSchedulerHistory: (jobName?: string) => Promise<JobRun[]>
      runJob: (name: string) => Promise<JobRun>
      getPipelineSummary: () => Promise<StageSummary[]>
      getHotLeads: () => Promise<HotLead[]>
      getTerritories: () => Promise<TerritoryData[]>
      getNewLeads: () => Promise<NewLead[]>
      getClaudeSessions: () => Promise<ClaudeSession[]>
      getGraphStats: () => Promise<GraphStats>
    }
  }
}
