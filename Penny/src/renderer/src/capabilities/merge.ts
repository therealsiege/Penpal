import { CAPABILITY_CATALOG, type CapabilityId } from './catalog'

export interface CapabilityRow {
  id: CapabilityId
  title: string
  status: string
  blurb: string
  validationSteps: string[]
}

/**
 * Merge IPC `capabilities:status` snapshot with the static catalog for Handbook / ops board rows.
 */
export function mergeCapabilityRows(items: Record<string, string>): CapabilityRow[] {
  const ids = Object.keys(CAPABILITY_CATALOG) as CapabilityId[]
  return ids.map((id) => {
    const entry = CAPABILITY_CATALOG[id]
    return {
      id,
      title: entry.title,
      status: items[id] ?? 'unknown',
      blurb: entry.blurb,
      validationSteps: entry.validationSteps,
    }
  })
}
