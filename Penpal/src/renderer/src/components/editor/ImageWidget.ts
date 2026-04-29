import { ViewPlugin, Decoration, type DecorationSet, type EditorView, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

class InlineImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string, readonly width?: number) { super() }

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-widget'
    wrapper.style.cssText = 'margin: 8px 0; line-height: 0;'

    const img = document.createElement('img')
    img.alt = this.alt
    img.style.cssText = 'max-width: 100%; border-radius: 4px; display: block;'
    if (this.width) img.style.width = `${this.width}px`

    if (this.src.startsWith('http://') || this.src.startsWith('https://')) {
      // External URL — use directly
      img.src = this.src
    } else {
      // Local vault asset — use vault:// protocol
      // Encode path components but keep slashes so the protocol handler can resolve relative paths
      const encoded = this.src.split('/').map(s => encodeURIComponent(s)).join('/')
      img.src = `vault://${encoded}`
      img.onerror = () => {
        img.style.display = 'none'
      }
    }

    wrapper.appendChild(img)
    return wrapper
  }

  eq(other: InlineImageWidget) {
    return this.src === other.src && this.alt === other.alt && this.width === other.width
  }
}

// Match ![[image.png]] or ![[image.png|400]] (Obsidian embeds)
const obsidianEmbedRegex = /!\[\[([^\]|]+\.(png|jpg|jpeg|gif|svg|webp))(?:\|(\d+))?\]\]/gi
// Match ![alt](path) where path contains an image extension (handles query params in URLs)
const mdImageRegex = /!\[([^\]]*)\]\(([^)]*\.(png|jpg|jpeg|gif|svg|webp)[^)]*)\)/gi

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    let match: RegExpExecArray | null

    obsidianEmbedRegex.lastIndex = 0
    while ((match = obsidianEmbedRegex.exec(line.text)) !== null) {
      const to = line.from + match.index + match[0].length
      const filename = match[1]
      const width = match[3] ? parseInt(match[3], 10) : undefined

      builder.add(to, to, Decoration.widget({
        widget: new InlineImageWidget(filename, filename, width),
        block: true,
      }))
    }

    mdImageRegex.lastIndex = 0
    while ((match = mdImageRegex.exec(line.text)) !== null) {
      const to = line.from + match.index + match[0].length
      const alt = match[1]
      const src = match[2]

      builder.add(to, to, Decoration.widget({
        widget: new InlineImageWidget(src, alt),
        block: true,
      }))
    }
  }

  return builder.finish()
}

export const imagePlugin = ViewPlugin.fromClass(
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
  { decorations: v => v.decorations }
)
