import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const sidebarDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#60a5fa',
    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", Menlo, monospace',
    lineHeight: '1.6',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#60a5fa',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#1e3a5f !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(30, 58, 95, 0.25)',
  },
  '.cm-gutters': {
    backgroundColor: '#0b1120',
    color: '#334155',
    border: 'none',
    paddingRight: '4px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(30, 58, 95, 0.25)',
    color: '#64748b',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#1e293b',
    color: '#64748b',
    border: 'none',
    padding: '0 4px',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    outline: '1px solid rgba(59, 130, 246, 0.4)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    outline: '1px solid rgba(250, 204, 21, 0.4)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(250, 204, 21, 0.35)',
  },
  '.cm-panels': {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    borderColor: '#1e293b',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid #1e293b',
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid #1e293b',
  },
  '.cm-tooltip': {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: '#1e3a5f',
      color: '#e2e8f0',
    },
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
}, { dark: true })

export const sidebarHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#e2e8f0', fontWeight: '700', fontSize: '1.4em' },
  { tag: tags.heading2, color: '#cbd5e1', fontWeight: '600', fontSize: '1.2em' },
  { tag: tags.heading3, color: '#94a3b8', fontWeight: '600', fontSize: '1.05em' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: '#94a3b8', fontWeight: '600' },
  { tag: tags.emphasis, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.strong, color: '#e2e8f0', fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#64748b' },
  { tag: tags.link, color: '#60a5fa', textDecoration: 'underline' },
  { tag: tags.url, color: '#60a5fa' },
  { tag: tags.monospace, color: '#93c5fd', fontFamily: 'ui-monospace, monospace' },
  { tag: tags.keyword, color: '#c084fc' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.number, color: '#fbbf24' },
  { tag: tags.bool, color: '#fb923c' },
  { tag: tags.comment, color: '#475569', fontStyle: 'italic' },
  { tag: tags.meta, color: '#64748b' },
  { tag: tags.processingInstruction, color: '#64748b' },
  { tag: tags.quote, color: '#94a3b8' },
  { tag: tags.list, color: '#60a5fa' },
  { tag: tags.contentSeparator, color: '#334155' },
])

export const darkThemeExtensions = [
  sidebarDarkTheme,
  syntaxHighlighting(sidebarHighlightStyle),
]
