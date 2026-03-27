import { useState } from 'react'

const TEMPLATES: Record<string, string> = {
  'Meeting Notes': `## Meeting Notes

**Date**: ${new Date().toISOString().slice(0, 10)}
**Attendees**:

### Agenda

1.

### Notes

### Action Items

- [ ] `,

  'Lead Profile': `---
company:
contact:
email:
phone:
stage: prospecting
score: 0
ehr:
state:
tags: [lead]
---

# Lead:

## Overview

## Needs

## Next Steps

- [ ] `,

  'Decision Log': `## Decision

**Date**: ${new Date().toISOString().slice(0, 10)}
**Status**: proposed

### Context

### Options Considered

1.
2.

### Decision

### Consequences

`,
}

interface TemplateInserterProps {
  onInsert: (content: string) => void
}

export function TemplateInserter({ onInsert }: TemplateInserterProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[#5a6a7a] hover:text-[#c4ccd6] px-2 py-1 rounded bg-[#141a22]/40 transition-colors"
        title="Insert template"
      >
        Template
      </button>
    )
  }

  return (
    <div className="relative">
      <div className="absolute top-full right-0 mt-1 bg-[#141a22] border border-[#2a3440] rounded-lg shadow-xl py-1 min-w-[160px] z-50 ring-1 ring-[#00ff88]/8">
        {Object.keys(TEMPLATES).map(name => (
          <button
            key={name}
            onClick={() => { onInsert(TEMPLATES[name]); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-[#c4ccd6] hover:bg-[#1a2430] transition-colors"
          >
            {name}
          </button>
        ))}
        <div className="border-t border-[#2a3440] mt-1 pt-1">
          <button
            onClick={() => setOpen(false)}
            className="w-full text-left px-3 py-1 text-xs text-[#5a6a7a] hover:text-[#c4ccd6] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
