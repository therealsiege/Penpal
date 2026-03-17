import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'

export function createOfficeGame(container: HTMLDivElement): {
  game: Phaser.Game
  scene: OfficeScene
} {
  const rect = container.getBoundingClientRect()

  const scene = new OfficeScene()

  const dpr = window.devicePixelRatio || 1

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: Math.floor(rect.width) || 800,
    height: Math.floor(rect.height) || 600,
    backgroundColor: '#0f172a',
    scene: [scene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
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
