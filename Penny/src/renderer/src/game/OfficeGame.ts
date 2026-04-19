import Phaser from 'phaser'
import { BootScene } from './boot-scene'
import { CampusScene } from './campus-scene'
import { OfficeScene } from './OfficeScene'
import { UIScene } from './ui-scene'

export function createOfficeGame(container: HTMLDivElement): {
  game: Phaser.Game
  scene: OfficeScene
} {
  const rect = container.getBoundingClientRect()

  const scene = new OfficeScene()

  // RESIZE mode: Phaser auto-sizes to the parent container.
  // NO_CENTER avoids the flex-layout drift/jump we saw with CENTER_BOTH.
  // No DPR zoom/resolution overrides — RESIZE mode reports CSS pixels directly,
  // which is what all layout math expects.  Text objects set resolution: 2 individually.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
    transparent: true,
    scene: [new BootScene(), new CampusScene(), scene, new UIScene()],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    input: {
      mouse: { preventDefaultWheel: true },
    },
  })

  // Take the canvas out of document flow so it can never inflate its flex parent.
  // This breaks the RESIZE-mode feedback loop at the CSS level:
  //   container size → Phaser reads it → sets canvas size → container unaffected (absolute)
  const canvas = game.canvas
  if (canvas) {
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.right = '0'
    canvas.style.bottom = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
  }

  // Expose for Playwright / debug access
  ;(window as any).__PENNY_GAME__ = game
  ;(window as any).__PENNY_SCENE__ = scene

  return { game, scene }
}
