import { vi } from 'vitest'

/** Chainable game object with Phaser-like data API */
export function createDataObject<T extends Record<string, unknown>>(base: T) {
  const data = new Map<string, unknown>()
  const obj = {
    ...base,
    x: (base as { x?: number }).x ?? 0,
    y: (base as { y?: number }).y ?? 0,
    alpha: (base as { alpha?: number }).alpha ?? 1,
    visible: (base as { visible?: boolean }).visible ?? true,
    scaleX: (base as { scaleX?: number }).scaleX ?? 1,
    scaleY: (base as { scaleY?: number }).scaleY ?? 1,
    setData(key: string, v: unknown) {
      data.set(key, v)
      return obj
    },
    getData(key: string) {
      return data.get(key)
    },
  }
  return obj
}

export type FakeSceneOptions = {
  zoom?: number
  viewWidth?: number
  viewHeight?: number
  texturesExist?: boolean
  animsExistKeys?: Set<string>
  /** If set, tweens.add captures configs here instead of running onComplete */
  captureTweenConfigs?: Record<string, unknown>[]
  /** Run onComplete immediately after add (default true for pool release tests) */
  tweensAutoComplete?: boolean
}

export function createRendererPhaserScene(options: FakeSceneOptions = {}) {
  const {
    zoom = 1,
    viewWidth = 800,
    viewHeight = 600,
    texturesExist = false,
    animsExistKeys = new Set<string>(),
    captureTweenConfigs,
    tweensAutoComplete = true,
  } = options

  const textures = { exists: vi.fn(() => texturesExist) }
  const anims = { exists: vi.fn((k: string) => animsExistKeys.has(k)) }

  let timeNow = 10_000

  const delayedCall = vi.fn((delay: number, fn: () => void) => {
    const handle = {
      destroy: vi.fn(),
      pendingDelay: delay,
      __invoke: () => {
        fn()
      },
    }
    return handle
  })

  const addEvent = vi.fn(() => ({ destroy: vi.fn() }))

  const killTweensOf = vi.fn()

  const tweensAdd = vi.fn((config: Record<string, unknown>) => {
    if (captureTweenConfigs) {
      captureTweenConfigs.push(config)
      return { destroy: vi.fn(), isPlaying: () => true, stop: vi.fn() }
    }
    const targets = config.targets as { alpha?: number; x?: number; y?: number; scaleX?: number; scaleY?: number } | undefined
    if (tweensAutoComplete) {
      if (targets && typeof config.alpha === 'number') targets.alpha = config.alpha
      if (targets && config.alpha && typeof config.alpha === 'object') {
        const a = config.alpha as { from?: number; to?: number }
        if (typeof a.to === 'number') targets.alpha = a.to
      }
    }
    if (tweensAutoComplete && config.onUpdate && config.duration === 1500) {
      const tw = { progress: 0 }
      ;(config.onUpdate as (t: { progress: number }) => void)(tw)
      tw.progress = 0.5
      ;(config.onUpdate as (t: { progress: number }) => void)(tw)
      tw.progress = 1
      ;(config.onUpdate as (t: { progress: number }) => void)(tw)
    }
    if (tweensAutoComplete && typeof config.onComplete === 'function') {
      ;(config.onComplete as () => void)()
    }
    return { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() }
  })

  const tweensAddCounter = vi.fn((config: Record<string, unknown>) => {
    if (tweensAutoComplete && typeof config.onComplete === 'function') {
      ;(config.onComplete as () => void)()
    }
    return { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() }
  })

  const line = vi.fn((...args: unknown[]) => {
    const [_ox, _oy, x1, y1, _x2, y2, _c, _a] = args as [number, number, number, number, number, number, number, number]
    const drop = createDataObject({
      x: x1 as number,
      y: y1 as number,
      visible: false,
      geom: { y1: Math.max(y1 as number, y2 as number) },
      setOrigin: vi.fn().mockReturnThis(),
      setLineWidth: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setVisible(v: boolean) {
        drop.visible = v
        return drop
      },
      destroy: vi.fn(),
    })
    return drop
  })

  const circle = vi.fn((_x: number, _y: number, _r: number, _c?: number, _a?: number) => {
    const c = createDataObject({
      x: 0,
      y: 0,
      visible: false,
      setDepth: vi.fn().mockReturnThis(),
      setVisible(v: boolean) {
        c.visible = v
        return c
      },
      setScrollFactor: vi.fn().mockReturnThis(),
      setBlendMode: vi.fn().mockReturnThis(),
      setFillStyle: vi.fn().mockReturnThis(),
      setStrokeStyle: vi.fn().mockReturnThis(),
      setRadius: vi.fn().mockReturnThis(),
      setPosition(x: number, y: number) {
        c.x = x
        c.y = y
        return c
      },
      setAlpha(a: number) {
        c.alpha = a
        return c
      },
      setScale: vi.fn().mockReturnThis(),
      setScaleX: vi.fn().mockReturnThis(),
      setScaleY: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })
    return c
  })

  const sprite = vi.fn((_x: number, _y: number, _key: string, frame?: number | string) => {
    const s = createDataObject({
      x: _x,
      y: _y,
      frame: frame ?? 0,
      visible: true,
      setDepth() { return s },
      setScrollFactor() { return s },
      setScale() { return s },
      setOrigin() { return s },
      setAlpha(a: number) {
        s.alpha = a
        return s
      },
      setTint() { return s },
      setBlendMode() { return s },
      setVisible(v: boolean) {
        s.visible = v
        return s
      },
      setPosition(x: number, y: number) {
        s.x = x
        s.y = y
        return s
      },
      play: vi.fn().mockReturnThis(),
      once: vi.fn((_ev: string, fn: () => void) => {
        fn()
        return s
      }),
      setFrame(f: number) {
        s.frame = f
        return s
      },
      destroy: vi.fn(),
    })
    return s
  })

  const graphicsInstances: ReturnType<typeof makeGraphics>[] = []

  function makeGraphics() {
    const fills: { color: number; alpha: number }[] = []
    const data = new Map<string, unknown>()
    const g = {
      fills,
      x: 0,
      y: 0,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      setData(key: string, v: unknown) {
        data.set(key, v)
        return g
      },
      getData(key: string) {
        return data.get(key)
      },
      setDepth() { return g },
      setScrollFactor() { return g },
      setVisible() { return g },
      setAlpha(a: number) {
        g.alpha = a
        return g
      },
      setPosition(x: number, y: number) {
        g.x = x
        g.y = y
        return g
      },
      setScale(s: number) {
        g.scaleX = s
        g.scaleY = s
        return g
      },
      clear() { return g },
      fillStyle(color: number, alpha?: number) {
        fills.push({ color, alpha: alpha ?? 1 })
        return g
      },
      fillRect: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      fillPoints: vi.fn().mockReturnThis(),
      fillTriangle: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      lineBetween: vi.fn().mockReturnThis(),
      beginPath: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
      strokePath: vi.fn().mockReturnThis(),
      fillEllipse: vi.fn().mockReturnThis(),
      strokeCircle: vi.fn().mockReturnThis(),
      setRotation: vi.fn().mockReturnThis(),
      generateTexture: vi.fn(),
      destroy: vi.fn(),
    }
    graphicsInstances.push(g)
    return g
  }

  const graphics = vi.fn(() => makeGraphics())

  const text = vi.fn(() =>
    createDataObject({
      x: 0,
      y: 0,
      visible: true,
      setDepth: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }),
  )

  const rectangle = vi.fn(() =>
    createDataObject({
      x: 0,
      y: 0,
      alpha: 1,
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }),
  )

  const particles = vi.fn(() => ({
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setParticleTint: vi.fn().mockReturnThis(),
    explode: vi.fn(),
    destroy: vi.fn(),
  }))

  const container = vi.fn(() => {
    const children: unknown[] = []
    const c = {
      x: 0,
      y: 0,
      alpha: 1,
      add: vi.fn((o: unknown) => {
        children.push(o)
        return c
      }),
      remove: vi.fn(),
      removeAll: vi.fn(),
      getAll: () => children,
      setAlpha: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }
    return c
  })

  const scene = {
    add: {
      line,
      circle,
      sprite,
      graphics,
      text,
      rectangle,
      particles,
      container,
    },
    make: {
      graphics: vi.fn(() => {
        const g = makeGraphics()
        return { ...g, generateTexture: vi.fn(), destroy: vi.fn() }
      }),
    },
    tweens: {
      add: tweensAdd,
      addCounter: tweensAddCounter,
      killTweensOf,
    },
    time: {
      get now() {
        return timeNow
      },
      setNow(v: number) {
        timeNow = v
      },
      addEvent,
      delayedCall,
    },
    cameras: {
      main: {
        width: viewWidth,
        height: viewHeight,
        zoom,
        worldView: { x: 0, y: 0, width: viewWidth, height: viewHeight },
        shake: vi.fn(),
      },
    },
    textures,
    anims,
    game: { loop: { delta: 16 } },
  }

  return {
    scene: scene as unknown as Phaser.Scene,
    graphicsInstances,
    line,
    circle,
    sprite,
    graphics,
    tweensAdd,
    tweensAddCounter,
    delayedCall,
    killTweensOf,
    setTimeNow(v: number) {
      timeNow = v
    },
  }
}
