import { ViewPlugin, Decoration, type DecorationSet, type EditorView, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

class PdfEmbedWidget extends WidgetType {
  constructor(readonly filename: string) { super() }

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-pdf-widget'
    wrapper.style.cssText = 'margin: 8px 0; padding: 12px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(51, 65, 85, 0.4); border-radius: 6px;'

    const label = document.createElement('div')
    label.style.cssText = 'color: #94a3b8; font-size: 11px; display: flex; align-items: center; gap: 6px;'
    label.textContent = '\u{1F4C4} ' + this.filename

    wrapper.appendChild(label)
    return wrapper
  }

  eq(other: PdfEmbedWidget) { return this.filename === other.filename }
}

const pdfEmbedRegex = /!\[\[([^\]|]+\.pdf)\]\]/gi

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    let match: RegExpExecArray | null
    pdfEmbedRegex.lastIndex = 0

    while ((match = pdfEmbedRegex.exec(line.text)) !== null) {
      const to = line.from + match.index + match[0].length
      builder.add(to, to, Decoration.widget({
        widget: new PdfEmbedWidget(match[1]),
        block: true,
      }))
    }
  }

  return builder.finish()
}

export const pdfPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = buildDecorations(view) }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations }
)
