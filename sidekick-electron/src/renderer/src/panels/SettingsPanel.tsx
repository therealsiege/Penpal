import { useAppearanceStore } from '../stores/appearance-store'

const FONT_OPTIONS = [
  { label: 'System Default', value: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'SF Pro', value: "'SF Pro Display', 'SF Pro', system-ui, sans-serif" },
  { label: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
]

const MONO_FONT_OPTIONS = [
  { label: 'System Mono', value: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, monospace" },
  { label: 'SF Mono', value: "'SF Mono', ui-monospace, monospace" },
  { label: 'Fira Code', value: "'Fira Code', ui-monospace, monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: 'Cascadia Code', value: "'Cascadia Code', ui-monospace, monospace" },
  { label: 'Menlo', value: "Menlo, ui-monospace, monospace" },
]

function NumberStepper({ value, onChange, min, max, step = 1, label }: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center transition-colors"
        >-</button>
        <span className="text-sm text-slate-200 w-10 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center transition-colors"
        >+</button>
      </div>
    </div>
  )
}

function FontSelect({ value, onChange, options, label }: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500 max-w-[200px]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function SettingsPanel() {
  const {
    theme, toggleTheme,
    uiFontFamily, setUiFontFamily, uiFontSize, setUiFontSize,
    editorFontFamily, setEditorFontFamily, editorFontSize, setEditorFontSize,
    editorLineHeight, setEditorLineHeight,
    zoom, setZoom,
  } = useAppearanceStore()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto py-8 px-6">
        <h1 className="text-lg font-semibold text-slate-200 mb-6">Settings</h1>

        {/* Appearance */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Appearance</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Theme</span>
              <button
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              >
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
            <NumberStepper label="Zoom Level" value={+(zoom * 100).toFixed(0)} onChange={v => setZoom(v / 100)} min={70} max={200} step={10} />
            <div className="text-xs text-slate-600">Tip: Use Cmd+= / Cmd+- in the Vault to zoom quickly</div>
          </div>
        </section>

        {/* UI Font */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Interface Font</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <FontSelect label="Font Family" value={uiFontFamily} onChange={setUiFontFamily} options={FONT_OPTIONS} />
            <NumberStepper label="Font Size" value={uiFontSize} onChange={setUiFontSize} min={10} max={24} />
            <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-700/40">
              <p className="text-slate-400" style={{ fontFamily: uiFontFamily, fontSize: `${uiFontSize}px` }}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>
        </section>

        {/* Editor Font */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Editor Font</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <FontSelect label="Font Family" value={editorFontFamily} onChange={setEditorFontFamily} options={MONO_FONT_OPTIONS} />
            <NumberStepper label="Font Size" value={editorFontSize} onChange={setEditorFontSize} min={10} max={28} />
            <NumberStepper label="Line Height" value={editorLineHeight} onChange={setEditorLineHeight} min={1.0} max={2.5} step={0.1} />
            <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-700/40 overflow-hidden">
              <pre className="text-slate-400" style={{ fontFamily: editorFontFamily, fontSize: `${editorFontSize}px`, lineHeight: editorLineHeight }}>
{`# Heading
The quick brown fox jumps
over the lazy dog.

- Item one
- Item two`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
