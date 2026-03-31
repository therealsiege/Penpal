import { describe, it, expect, afterEach } from 'vitest'
import {
  resolveProjectPath,
  pathsReferToSameRepo,
  migratePersistedProject,
  getAtlasRoot,
  getSidekickRoot,
} from '../../src/main/project-paths'

describe('project-paths', () => {
  const origAtlas = process.env.PENNY_ATLAS_ROOT
  const origSidekick = process.env.PENNY_SIDEKICK_ROOT

  afterEach(() => {
    if (origAtlas === undefined) delete process.env.PENNY_ATLAS_ROOT
    else process.env.PENNY_ATLAS_ROOT = origAtlas
    if (origSidekick === undefined) delete process.env.PENNY_SIDEKICK_ROOT
    else process.env.PENNY_SIDEKICK_ROOT = origSidekick
  })

  it('resolves atlas alias', () => {
    delete process.env.PENNY_ATLAS_ROOT
    expect(resolveProjectPath('atlas')).toBe(getAtlasRoot())
    expect(resolveProjectPath('Atlas')).toBe(getAtlasRoot())
    expect(resolveProjectPath('graphiteatlas/atlas')).toBe(getAtlasRoot())
  })

  it('respects PENNY_ATLAS_ROOT', () => {
    process.env.PENNY_ATLAS_ROOT = '/tmp/penny-atlas-test'
    expect(resolveProjectPath('atlas')).toBe('/tmp/penny-atlas-test')
  })

  it('resolves penny/sidekick aliases', () => {
    delete process.env.PENNY_SIDEKICK_ROOT
    expect(resolveProjectPath('sidekick')).toBe(getSidekickRoot())
    expect(resolveProjectPath('penny')).toBe(getSidekickRoot())
  })

  it('expands tilde paths', () => {
    const home = process.env.HOME || '/'
    expect(resolveProjectPath('~/foo-bar-project')).toBe(`${home}/foo-bar-project`)
  })

  it('migratePersistedProject uses atlas when empty', () => {
    delete process.env.PENNY_ATLAS_ROOT
    expect(migratePersistedProject('')).toBe(getAtlasRoot())
    expect(migratePersistedProject('  ')).toBe(getAtlasRoot())
  })

  it('pathsReferToSameRepo for alias vs expanded', () => {
    delete process.env.PENNY_ATLAS_ROOT
    expect(pathsReferToSameRepo('atlas', getAtlasRoot())).toBe(true)
  })
})
