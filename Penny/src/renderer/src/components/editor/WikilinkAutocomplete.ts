import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { useVaultIndex } from '../../stores/vault-index'

export function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  // Check if we're inside [[ ... ]]
  const before = context.matchBefore(/\[\[[^\]]*/)
  if (!before) return null

  const query = before.text.slice(2) // strip the [[

  const index = useVaultIndex.getState()
  const results = index.search(query, 30)

  return {
    from: before.from + 2,
    options: results.map(entry => {
      const folder = entry.path.split('/').slice(0, -1).join('/')
      return {
        label: entry.name.replace(/\.md$/, ''),
        detail: folder || undefined,
        type: 'text',
        apply: entry.name.replace(/\.md$/, '') + ']]',
      }
    }),
    filter: false,
  }
}
