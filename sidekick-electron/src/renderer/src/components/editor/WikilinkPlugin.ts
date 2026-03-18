import { ViewPlugin, Decoration, type DecorationSet, type EditorView, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

class WikilinkWidget extends WidgetType {
  constructor(readonly display: string, readonly target: string) { super() }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-wikilink'
    span.textContent = display(this.display)
    span.style.cssText = 'color: #60a5fa; cursor: pointer; text-decoration: underline; text-underline-offset: 2px;'
    span.dataset.target = this.target
    return span
  }

  eq(other: WikilinkWidget) {
    return this.display === other.display && this.target === other.target
  }
}

function display(text: string): string {
  return text
}

const wikilinkRegex = /\[\[([^\]]+)\]\]/g

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    let match: RegExpExecArray | null
    wikilinkRegex.lastIndex = 0

    while ((match = wikilinkRegex.exec(line.text)) !== null) {
      const from = line.from + match.index
      const to = from + match[0].length
      const inner = match[1]
      const parts = inner.split('|')
      const target = parts[0].trim()
      const displayText = (parts[1] || parts[0]).trim()

      builder.add(from, to, Decoration.replace({
        widget: new WikilinkWidget(displayText, target),
      }))
    }
  }

  return builder.finish()
}

export const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: v => v.decorations,
    eventHandlers: {
      click(e: MouseEvent, view: EditorView) {
        const target = e.target as HTMLElement
        if (target.classList.contains('cm-wikilink') && target.dataset.target) {
          // Dispatch custom event for the React layer to handle
          const event = new CustomEvent('wikilink-navigate', {
            detail: { target: target.dataset.target },
            bubbles: true,
          })
          view.dom.dispatchEvent(event)
          return true
        }
        return false
      },
    },
  }
)
