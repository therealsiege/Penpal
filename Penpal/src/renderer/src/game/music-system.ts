// ---------------------------------------------------------------------------
// music-system.ts
// Adaptive music system for RPG audio layering with activity-based mixing.
// ---------------------------------------------------------------------------
import type Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import { AUDIO_KEYS } from './office-asset-keys'
import { soundEngine } from './sound-engine'

// ---------------------------------------------------------------------------
// MusicSystem class — manages track layers based on lab activity
// ---------------------------------------------------------------------------

export class MusicSystem {
  private scene: Phaser.Scene | null = null
  private layers: {
    base: Phaser.Sound | null
    rhythm: Phaser.Sound | null
    melody: Phaser.Sound | null
    intensity: Phaser.Sound | null
  } = {
    base: null,
    rhythm: null,
    melody: null,
    intensity: null,
  }

  private currentActivity: 'quiet' | 'active' | 'busy' | 'intense' = 'quiet'
  private isNight: boolean = false
  private crossfadeDuration: number = 2000 // 2 seconds crossfade
  private isPlaying: boolean = false

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor() {
    // Listen for activity updates from the EventBus
    EventBus.on(EVENTS.LAB_ACTIVITY_UPDATE, (activity: 'quiet' | 'active' | 'busy' | 'intense') => {
      this.setState(activity)
    })
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Initialize MusicSystem with a Phaser scene.
   * Must be called once after scene create.
   */
  init(scene: Phaser.Scene): void {
    this.scene = scene
    this.preloadTracks()
    this.setupEventListeners()
  }

  /**
   * Set the current activity level to adjust music layers.
   * @param activity - Current lab activity level
   */
  setState(activity: 'quiet' | 'active' | 'busy' | 'intense'): void {
    this.currentActivity = activity
    
    // Apply state-specific layer configuration
    this.updateLayers()
  }

  /**
   * Play a stinger sound effect.
   * @param type - Type of stinger to play
   */
  playStinger(type: 'celebration' | 'error' | 'discovery'): void {
    if (!this.scene) return
    
    // Play appropriate sound based on stinger type
    switch (type) {
      case 'celebration':
        // Use one of the existing SFX as a celebratory stinger
        soundEngine.levelUp()
        break
      case 'error':
        // Use error sound
        soundEngine.error()
        break
      case 'discovery':
        // Use achievement sound
        soundEngine.achievement()
        break
    }
  }

  /**
   * Set night mode - affects tempo and adds reverb feel.
   */
  setNightMode(isNight: boolean): void {
    this.isNight = isNight
    
    // Apply tempo change to all playing tracks
    if (this.isNight) {
      Object.values(this.layers).forEach(layer => {
        if (layer && layer.isPlaying) {
          layer.setRate(0.85)
        }
      })
    } else {
      // Restore normal tempo
      Object.values(this.layers).forEach(layer => {
        if (layer && layer.isPlaying) {
          layer.setRate(1.0)
        }
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Preload all music tracks.
   */
  private preloadTracks(): void {
    if (!this.scene) return
    
    try {
      // Base track (ambient pad) - always loaded
      if (this.scene.cache.audio.exists(AUDIO_KEYS.MUSIC_BASE)) {
        this.layers.base = this.scene.sound.add(AUDIO_KEYS.MUSIC_BASE, { loop: true });
      }
      
      // Rhythm track (subtle percussion) - always loaded
      if (this.scene.cache.audio.exists(AUDIO_KEYS.MUSIC_RHYTHM)) {
        this.layers.rhythm = this.scene.sound.add(AUDIO_KEYS.MUSIC_RHYTHM, { loop: true });
      }
      
      // Melody track (synth melody line) - always loaded
      if (this.scene.cache.audio.exists(AUDIO_KEYS.MUSIC_MELODY)) {
        this.layers.melody = this.scene.sound.add(AUDIO_KEYS.MUSIC_MELODY, { loop: true });
      }
      
      // Intensity track (full arrangement) - always loaded
      if (this.scene.cache.audio.exists(AUDIO_KEYS.MUSIC_INTENSITY)) {
        this.layers.intensity = this.scene.sound.add(AUDIO_KEYS.MUSIC_INTENSITY, { loop: true });
      }
      
      // Start base track immediately
      if (this.layers.base) {
        this.layers.base.play({ loop: true })
        this.isPlaying = true
      }
    } catch (e) {
      console.warn('Music system: Could not preload music tracks:', e)
    }
  }

  /**
   * Setup EventBus listeners for updates.
   */
  private setupEventListeners(): void {
    // No additional event listeners needed - rely on LAB_ACTIVITY_UPDATE
  }

  /**
   * Update music layers based on current activity state.
   */
  private updateLayers(): void {
    if (!this.scene) return

    // Apply volume and layer rules based on current state
    const volume = this.getVolumeForActivity()
    
    // Update layers
    this.updateLayer('base', volume)
    
    // Conditional tracks
    switch (this.currentActivity) {
      case 'quiet':
        // Only base track
        this.updateLayer('rhythm', 0)
        this.updateLayer('melody', 0)
        this.updateLayer('intensity', 0)
        break
      case 'active':
        // Base + rhythm
        this.updateLayer('rhythm', volume * 0.5)
        this.updateLayer('melody', 0)
        this.updateLayer('intensity', 0)
        break
      case 'busy':
        // Base + rhythm + melody
        this.updateLayer('rhythm', volume * 0.5)
        this.updateLayer('melody', volume * 0.4)
        this.updateLayer('intensity', 0)
        break
      case 'intense':
        // All tracks
        this.updateLayer('rhythm', volume * 0.4)
        this.updateLayer('melody', volume * 0.5)
        this.updateLayer('intensity', volume * 0.5)
        break
    }
  }

  /**
   * Get the volume level for the current activity.
   * @returns Volume level (0 to 1)
   */
  private getVolumeForActivity(): number {
    switch (this.currentActivity) {
      case 'quiet':
        return 0.2
      case 'active':
        return 0.3
      case 'busy':
        return 0.35
      case 'intense':
        return 0.4
      default:
        return 0.2
    }
  }
}