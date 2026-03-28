import { describe, it, expect } from 'vitest'
import { buildSearchWhereAndParams } from '../../src/main/graph'

describe('buildSearchWhereAndParams', () => {
  it('composes text match only when no filters', () => {
    const { whereClause, params } = buildSearchWhereAndParams('acme')
    expect(whereClause).toContain('toLower(l.name)')
    expect(whereClause).not.toContain('t.name')
    expect(params).toEqual({ q: 'acme' })
  })

  it('adds territory and EHR and stage predicates with params', () => {
    const { whereClause, params } = buildSearchWhereAndParams('x', {
      state: 'TX',
      ehr: 'Epic',
      stage: 'qualified',
    })
    expect(whereClause).toContain('t.name = $state')
    expect(whereClause).toContain('e.name = $ehr')
    expect(whereClause).toContain('s.name = $stage')
    expect(params).toMatchObject({
      q: 'x',
      state: 'TX',
      ehr: 'Epic',
      stage: 'qualified',
    })
  })
})
