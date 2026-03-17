import { useEffect } from 'react'
import { PipelinePanel } from '../panels/PipelinePanel'

interface PipelineModalProps {
  onClose: () => void
}

export function PipelineModal({ onClose }: PipelineModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Sales Pipeline</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <PipelinePanel />
        </div>
      </div>
    </div>
  )
}
