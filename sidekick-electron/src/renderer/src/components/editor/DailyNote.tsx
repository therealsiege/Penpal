import { useCallback } from 'react'
import { useToast } from '../Toast'

interface DailyNoteProps {
  onOpenFile: (path: string) => void
}

export function DailyNote({ onOpenFile }: DailyNoteProps) {
  const { toast } = useToast()

  const handleCreate = useCallback(async () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const filePath = `Daily Notes/${dateStr}.md`

    try {
      // Try to read existing daily note
      const existing = await window.api.vaultRead(filePath)
      if (existing?.content != null) {
        onOpenFile(filePath)
        return
      }
    } catch { /* doesn't exist, create it */ }

    // Create new daily note
    const content = `---
date: ${dateStr}
tags: [daily]
---

# ${dateStr}

## Tasks

- [ ]

## Notes

`
    try {
      await window.api.vaultCreate(filePath, content)
      onOpenFile(filePath)
      toast('Daily note created', 'success')
    } catch (err) {
      toast('Failed: ' + (err as Error).message, 'error')
    }
  }, [onOpenFile, toast])

  return (
    <button
      onClick={handleCreate}
      className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded bg-slate-800/40 transition-colors"
      title="Open today's daily note"
    >
      Today
    </button>
  )
}
