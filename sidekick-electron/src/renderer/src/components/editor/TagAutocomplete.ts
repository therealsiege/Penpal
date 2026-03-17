import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { useVaultIndex } from '../../stores/vault-index'

export function tagCompletionSource(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/#[\w-/]*/)
  if (!before) return null

  const query = before.text.slice(1) // strip the #

  const index = useVaultIndex.getState()
  // Collect all known tags
  const tagSet = new Set<string>()
  for (const entry of index.entries) {
    for (const tag of entry.tags) {
      tagSet.add(tag)
    }
  }

  const allTags = Array.from(tagSet).sort()
  const filtered = query
    ? allTags.filter(t => t.toLowerCase().startsWith(query.toLowerCase()))
    : allTags

  return {
    from: before.from + 1,
    options: filtered.slice(0, 30).map(tag => ({
      label: tag,
      type: 'keyword',
    })),
    filter: false,
  }
}
