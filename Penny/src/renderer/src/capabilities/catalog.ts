export type CapabilityId = 'orchestrator'

export interface CapabilityCatalogEntry {
  title: string
  blurb: string
  validationSteps: string[]
}

export const CAPABILITY_CATALOG: Record<CapabilityId, CapabilityCatalogEntry> = {
  orchestrator: {
    title: 'Orchestrator',
    blurb: 'Coordinates task queues and agent workflows across the Penny platform.',
    validationSteps: [
      'Confirm the orchestrator queue responds to list and dequeue operations.',
      'Run a smoke pod workflow and verify status transitions.',
    ],
  },
}

export function listCapabilities(): CapabilityId[] {
  return Object.keys(CAPABILITY_CATALOG) as CapabilityId[]
}
