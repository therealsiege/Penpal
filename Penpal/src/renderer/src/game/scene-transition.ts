import { SCENE_KEYS } from './office-asset-keys'

// ---------------------------------------------------------------------------
// SceneTransition — smooth fade/flash transitions between Phaser scenes
// ---------------------------------------------------------------------------

type SceneKey = typeof SCENE_KEYS[keyof typeof SCENE_KEYS]

export class SceneTransition {
  /**
   * Fade the current scene's camera to black, sleep it, wake/launch the
   * target scene, then fade that scene's camera back in from black.
   */
  static fadeToScene(
    currentScene: Phaser.Scene,
    targetSceneKey: SceneKey,
    duration = 300,
  ): void {
    const cam = currentScene.cameras.main
    if (!cam) return

    cam.fadeOut(duration, 0, 0, 0)

    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Wake or launch the target
      if (currentScene.scene.isSleeping(targetSceneKey)) {
        currentScene.scene.wake(targetSceneKey)
      } else if (!currentScene.scene.isActive(targetSceneKey)) {
        currentScene.scene.launch(targetSceneKey)
      }

      // Sleep the current scene
      currentScene.scene.sleep(currentScene.scene.key)

      // Reset this camera so it's ready if we come back
      cam.resetFX()

      // Fade the target scene in from black
      const targetScene = currentScene.scene.get(targetSceneKey)
      if (targetScene) {
        const targetCam = targetScene.cameras.main
        if (targetCam) {
          targetCam.fadeIn(duration, 0, 0, 0)
        }
      }
    })
  }

  /**
   * Quick white flash — useful for special/dramatic transitions.
   */
  static flashTransition(scene: Phaser.Scene, duration = 150): void {
    const cam = scene.cameras.main
    if (!cam) return
    cam.flash(duration, 255, 255, 255)
  }
}
