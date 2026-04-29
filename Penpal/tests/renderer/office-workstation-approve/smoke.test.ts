// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {},
}))

vi.mock('../../../src/renderer/src/game/workstation-animation', () => ({
  WorkstationAnimator: class {
    updateAnimation() {}
    updateMonitorGlow() {}
    updateBlockedIndicator() {}
    getAgentMood() { return { emoji: '', color: '#fff' } }
    updateMood() {}
    drawThoughtBubbleBg() {}
    updateThoughtBubble() {}
  },
}))

vi.mock('../../../src/renderer/src/game/workstation-creation', () => ({
  WorkstationFactory: class {
    create() { return {} }
    layout() {}
    destroy() {}
    ensureCoffeeIndicator() {}
    removeCoffeeIndicator() {}
  },
}))

import { EventBus, EVENTS } from '../../../src/renderer/src/game/events'
import { OfficeWorkstations } from '../../../src/renderer/src/game/office-workstation'

function makeWorkstation(overrides: { needsInteraction?: boolean; visible?: boolean; alpha?: number; x?: number; y?: number } = {}) {
  return {
    container: {
      x: overrides.x ?? 40,
      y: overrides.y ?? 60,
      visible: overrides.visible ?? true,
      alpha: overrides.alpha ?? 1,
    },
    state: { needsInteraction: overrides.needsInteraction ?? false },
  } as any
}

function makeHost(rooms: Map<string, any>, lod = 3) {
  return {
    showToast: vi.fn(),
    spawnEmojiReaction: vi.fn(),
    spawnSpriteReaction: vi.fn(),
    spawnAlertRipple: vi.fn(),
    burstConfetti: vi.fn(),
    spawnSteamParticles: vi.fn(),
    clearSteamParticles: vi.fn(),
    spawnFlameParticle: vi.fn(),
    getAgentCharacterIndex: vi.fn(),
    getPoseFrame: vi.fn(),
    getStatusColor: vi.fn(),
    getPodLines: vi.fn(() => []),
    applyLodToWorkstation: vi.fn(),
    getLastLodLevel: vi.fn(() => lod),
    enterFocusMode: vi.fn(),
    drawHoverRing: vi.fn(),
    clearHoverRing: vi.fn(),
    showRichTooltip: vi.fn(),
    hideTooltip: vi.fn(),
    officeTilesLoaded: true,
    getRooms: vi.fn(() => rooms),
    isCoffeeRunActive: vi.fn(() => false),
    cancelCoffeeRun: vi.fn(),
    celebrations: { approveSparkle: vi.fn() },
    propsManager: {} as any,
    getNavMesh: vi.fn(),
  } as any
}

describe('OfficeWorkstations AGENT_APPROVED sparkle routing', () => {
  beforeEach(() => {
    EventBus.removeAll()
  })

  it('triggers sparkle for a single approved agent workstation', () => {
    const ws = makeWorkstation({ x: 12, y: 34 })
    const room = { x: 100, y: 200, workstations: new Map([['agent-1', ws]]) }
    const rooms = new Map([['room-a', room]])
    const host = makeHost(rooms, 3)
    const sut = new OfficeWorkstations({} as any, host)

    EventBus.emit(EVENTS.AGENT_APPROVED, 'agent-1', 'tty-1')

    expect(host.celebrations.approveSparkle).toHaveBeenCalledTimes(1)
    expect(host.celebrations.approveSparkle).toHaveBeenCalledWith(112, 234)
    sut.destroy()
  })

  it('bulk approve sparkles only waiting workstations', () => {
    const waiting = makeWorkstation({ needsInteraction: true, x: 10, y: 10 })
    const idle = makeWorkstation({ needsInteraction: false, x: 20, y: 20 })
    const room = {
      x: 50,
      y: 75,
      workstations: new Map([
        ['agent-waiting', waiting],
        ['agent-idle', idle],
      ]),
    }
    const rooms = new Map([['room-a', room]])
    const host = makeHost(rooms, 3)
    const sut = new OfficeWorkstations({} as any, host)

    EventBus.emit(EVENTS.AGENT_APPROVED, '__all__', '')

    expect(host.celebrations.approveSparkle).toHaveBeenCalledTimes(1)
    expect(host.celebrations.approveSparkle).toHaveBeenCalledWith(60, 85)
    sut.destroy()
  })

  it('does not sparkle in overview LOD', () => {
    const ws = makeWorkstation({ needsInteraction: true })
    const room = { x: 0, y: 0, workstations: new Map([['agent-1', ws]]) }
    const rooms = new Map([['room-a', room]])
    const host = makeHost(rooms, 1)
    const sut = new OfficeWorkstations({} as any, host)

    EventBus.emit(EVENTS.AGENT_APPROVED, 'agent-1', 'tty-1')

    expect(host.celebrations.approveSparkle).not.toHaveBeenCalled()
    sut.destroy()
  })

  it('does not sparkle when workstation container is hidden or faded', () => {
    const hidden = makeWorkstation({ needsInteraction: true, visible: false, alpha: 1 })
    const faded = makeWorkstation({ needsInteraction: true, visible: true, alpha: 0.01, x: 30, y: 30 })
    const room = {
      x: 0,
      y: 0,
      workstations: new Map([
        ['agent-hidden', hidden],
        ['agent-faded', faded],
      ]),
    }
    const rooms = new Map([['room-a', room]])
    const host = makeHost(rooms, 3)
    const sut = new OfficeWorkstations({} as any, host)

    EventBus.emit(EVENTS.AGENT_APPROVED, 'agent-hidden', 'tty-hidden')
    EventBus.emit(EVENTS.AGENT_APPROVED, 'agent-faded', 'tty-faded')
    EventBus.emit(EVENTS.AGENT_APPROVED, '__all__', '')

    expect(host.celebrations.approveSparkle).not.toHaveBeenCalled()
    sut.destroy()
  })
})
