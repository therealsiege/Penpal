export type CapabilityId =
  | 'orchestrator'
  | 'graph'
  | 'evals'
  | 'vault'
  | 'pods'
  | 'spot_check'
  | 'mcp'

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
  graph: {
    title: 'Knowledge Graph',
    blurb: 'Memgraph + Qdrant graph and vector store backing entity extraction and semantic search.',
    validationSteps: [
      'Verify Memgraph connection returns node counts.',
      'Run a Qdrant collection stats check and confirm at least one collection exists.',
    ],
  },
  evals: {
    title: 'Evals Harness',
    blurb: 'Automated evaluation pipeline for scoring agent outputs against golden datasets.',
    validationSteps: [
      'Confirm the evals runner can load at least one golden dataset.',
      'Execute a dry-run eval and verify a score report is produced.',
    ],
  },
  vault: {
    title: 'Vault',
    blurb: 'Obsidian vault reader providing document parsing, tag extraction, and link traversal.',
    validationSteps: [
      'Confirm the vault root resolves to a valid directory.',
      'Parse one markdown file and verify frontmatter and body are returned.',
    ],
  },
  pods: {
    title: 'Pods',
    blurb: 'Pod agent team engine running Solver → Reviewer → Executor triplet workflows.',
    validationSteps: [
      'List active pods and confirm the state machine responds.',
      'Create a dry-run pod and verify it reaches the solving stage.',
    ],
  },
  spot_check: {
    title: 'Spot-Check Queue',
    blurb: 'Human-in-the-loop queue for flagging agent outputs that require manual review.',
    validationSteps: [
      'Confirm the spot-check queue can be listed without error.',
      'Enqueue a test item and verify it appears in the queue with correct metadata.',
    ],
  },
  mcp: {
    title: 'MCP Stdio',
    blurb: 'Model Context Protocol stdio transport exposing tools and resources to connected agents.',
    validationSteps: [
      'Confirm the MCP server process starts and responds to an initialize request.',
      'List available tools and verify at least one tool is registered.',
    ],
  },
}

export function listCapabilities(): CapabilityId[] {
  return Object.keys(CAPABILITY_CATALOG) as CapabilityId[]
}
