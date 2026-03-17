import { useRef, useEffect, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { darkThemeExtensions } from './cm-theme'
import { wikilinkPlugin } from './WikilinkPlugin'
import { wikilinkCompletionSource } from './WikilinkAutocomplete'
import { imagePlugin } from './ImageWidget'
import { tagCompletionSource } from './TagAutocomplete'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onNavigate?: (target: string) => void
}

export function MarkdownEditor({ content, onChange, onSave, onNavigate }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onNavigateRef = useRef(onNavigate)

  onChangeRef.current = onChange
  onSaveRef.current = onSave
  onNavigateRef.current = onNavigate

  const lastSetContent = useRef(content)

  const createView = useCallback(() => {
    if (!containerRef.current) return

    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: () => { onSaveRef.current(); return true },
    }])

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        const newContent = update.state.doc.toString()
        lastSetContent.current = newContent
        onChangeRef.current(newContent)
      }
    })

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...darkThemeExtensions,
        EditorView.lineWrapping,
        drawSelection(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        foldGutter(),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        autocompletion({ override: [wikilinkCompletionSource, tagCompletionSource] }),
        wikilinkPlugin,
        imagePlugin,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          indentWithTab,
        ]),
        saveKeymap,
        updateListener,
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    })
  }, [])

  useEffect(() => {
    createView()

    // Listen for wikilink navigation events
    const container = containerRef.current
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.target && onNavigateRef.current) {
        onNavigateRef.current(detail.target)
      }
    }
    container?.addEventListener('wikilink-navigate', handler)

    return () => {
      container?.removeEventListener('wikilink-navigate', handler)
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [createView])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (content === lastSetContent.current) return

    lastSetContent.current = content
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    })
  }, [content])

  return (
    <div ref={containerRef} className="h-full overflow-hidden" />
  )
}
