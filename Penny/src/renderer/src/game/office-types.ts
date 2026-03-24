import Phaser from 'phaser'
import type { AgentState } from '../types'

// ---------------------------------------------------------------------------
// Shared type definitions for the Office game scene
// ---------------------------------------------------------------------------

export interface WorkstationSprite {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  nameText: Phaser.GameObjects.Text
  statusDot: Phaser.GameObjects.Arc
  roleBadge: Phaser.GameObjects.Text | null
  deskBody: Phaser.GameObjects.Rectangle
  deskTop: Phaser.GameObjects.Rectangle
  monitorSprite: Phaser.GameObjects.Sprite | null
  chairSprite: Phaser.GameObjects.Sprite | null
  monitorGlowFx?: Phaser.FX.Glow
  screenLines?: Phaser.GameObjects.Graphics
  monitorText?: Phaser.GameObjects.Text
  monitorTextTween?: Phaser.Tweens.Tween
  thoughtBubble: Phaser.GameObjects.Container
  thoughtBubbleText: Phaser.GameObjects.Text
  thoughtBubbleBg: Phaser.GameObjects.Graphics
  blockedIndicator: Phaser.GameObjects.Container
  blockedIndicatorPulse: Phaser.GameObjects.Arc
  blockedIndicatorBadge: Phaser.GameObjects.Arc
  blockedIndicatorStem: Phaser.GameObjects.Rectangle
  blockedIndicatorText: Phaser.GameObjects.Text
  state: AgentState | null
  breathTween?: Phaser.Tweens.Tween
  bounceTween?: Phaser.Tweens.Tween
  dotPulseTween?: Phaser.Tweens.Tween
  monitorGlowTween?: Phaser.Tweens.Tween
  screenTween?: Phaser.Tweens.Tween
  typingTween?: Phaser.Tweens.Tween
  headTiltTween?: Phaser.Tweens.Tween
  pulseTween?: Phaser.Tweens.Tween
  steamTweens?: Phaser.Tweens.Tween[]
  steamContainer?: Phaser.GameObjects.Container
  lastAnimMode?: 'idle' | 'working' | 'waiting'
  lastStateFingerprint?: string
  /** Level 2+: shown at room-level zoom (agents, desks, status dots, name tags) */
  lodLevel2Objects: Phaser.GameObjects.GameObject[]
  /** Level 3 only: shown at full-detail zoom (accessories, lamps, mugs, ledGlow, monitorText, moodEmoji) */
  lodLevel3Objects: Phaser.GameObjects.GameObject[]
  lookAroundTimer?: Phaser.Time.TimerEvent
  stretchTimer?: Phaser.Time.TimerEvent
  walkBreakTimer?: Phaser.Time.TimerEvent
  walkBreakTween?: Phaser.Tweens.Tween
  lookAtNeighborTimer?: Phaser.Time.TimerEvent
  yawnTimer?: Phaser.Time.TimerEvent
  blockedIndicatorTween?: Phaser.Tweens.Tween
  ledGlow?: Phaser.GameObjects.Graphics
  ledPulseTween?: Phaser.Tweens.Tween
  lastShownBlurb?: string
  blurbFadeTimer?: Phaser.Time.TimerEvent
  thoughtBubbleFloatTween?: Phaser.Tweens.Tween
  blurbTypingTween?: Phaser.Tweens.Tween
  moodEmoji?: Phaser.GameObjects.Text
  moodTween?: Phaser.Tweens.Tween
  deskPlantTween?: Phaser.Tweens.Tween
  xpBarBg?: Phaser.GameObjects.Rectangle
  xpBarFill?: Phaser.GameObjects.Rectangle
  xpBarText?: Phaser.GameObjects.Text
  xpBarTween?: Phaser.Tweens.Tween
  rippleFired?: boolean
  soundWaveGfx?: Phaser.GameObjects.Graphics
  soundWaveTween?: Phaser.Tweens.Tween
  sparklineGfx?: Phaser.GameObjects.Graphics
  activityHistory?: number[]
  phoneLight?: Phaser.GameObjects.Arc
  phoneLightTween?: Phaser.Tweens.Tween
  progressRing?: Phaser.GameObjects.Graphics
  progressRingTween?: Phaser.Tweens.Tween
  workStartTime?: number
  shadow?: Phaser.GameObjects.Ellipse
  uptimeText?: Phaser.GameObjects.Text
  roleBadgePulseTween?: Phaser.Tweens.Tween
  // Task completion tally — increments each time an agent transitions working→idle
  taskCountText?: Phaser.GameObjects.Text
  taskCountBg?: Phaser.GameObjects.Graphics
  taskCountFlashTween?: Phaser.Tweens.Tween
  localTaskCount: number
  onCoffeeRun?: boolean
  coffeeIndicator?: Phaser.GameObjects.Text
}

export interface Room {
  cwd: string
  label: string
  teamKey: string
  teamLabel: string
  agents: AgentState[]
  x: number
  y: number
  width: number
  height: number
  container: Phaser.GameObjects.Container
  workstations: Map<string, WorkstationSprite>
  floorGraphics: Phaser.GameObjects.Graphics
  activityBar: Phaser.GameObjects.Rectangle
  activityBarTween: Phaser.Tweens.Tween | null
  waitingBar: Phaser.GameObjects.Rectangle
  waitingBarTween: Phaser.Tweens.Tween | null
  statusLed: Phaser.GameObjects.Arc
  statusLedGlow: Phaser.GameObjects.Arc
  statusLedTween: Phaser.Tweens.Tween | null
  ledMode: 'idle' | 'active' | 'waiting'
  // Animated door
  doorGraphics: Phaser.GameObjects.Graphics
  doorFrameGraphics: Phaser.GameObjects.Graphics
  doorPulseTween: Phaser.Tweens.Tween | null
  prevAgentCount: number
  // Thermal heat overlay — glows warmer as agent activity increases
  heatOverlay?: Phaser.GameObjects.Rectangle
  heatTween?: Phaser.Tweens.Tween
  // Header status strip — 2px bar below accent line, width proportional to active agents
  statusStrip: Phaser.GameObjects.Graphics | null
  statusStripTween: Phaser.Tweens.Tween | null
  // Badge dot pulse tween
  badgeDotTween: Phaser.Tweens.Tween | null
  // Tiled floor texture sprites (very-low-alpha overlays from room-tiles spritesheet)
  floorTileSprites?: Phaser.GameObjects.Sprite[]
  miniWhiteboard?: Phaser.GameObjects.Container
  miniWhiteboardTexts?: Phaser.GameObjects.Text[]
  doorSide: 'top' | 'bottom'
}

export interface TeamAreaLayout {
  teamKey: string
  teamLabel: string
  x: number
  y: number
  width: number
  height: number
  agentCount: number
}

// Pod workflow info for connecting lines
export interface PodLineInfo {
  workflowId: string
  solverAgentId: string
  reviewerAgentId: string
  executorAgentId: string
  status: string
}

export interface OfficeDebugSnapshot {
  ready: boolean
  roomCount: number
  workstationCount: number
  camera: {
    scrollX: number
    scrollY: number
    zoom: number
  }
  world: {
    width: number
    height: number
  }
}
