import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'

export function createOfficeGame(container: HTMLDivElement): {
  game: Phaser.Game
  scene: OfficeScene
} {
  const rect = container.getBoundingClientRect()

  const scene = new OfficeScene()

  // Keep high-DPI rendering sharp and visual sizing consistent across displays.
  // NO_CENTER avoids the flex-layout drift/jump we saw with CENTER_BOTH.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    // If the container hasn't measured yet, start tiny and let RESIZE mode
    // immediately grow to the real size on the first layout tick.
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
    backgroundColor: '#0f172a',
    scene: [scene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      zoom: 1 / dpr,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    resolution: dpr,
    input: {
      mouse: { preventDefaultWheel: true },
    },
    audio: { noAudio: true },
  })

  return { game, scene }
}
