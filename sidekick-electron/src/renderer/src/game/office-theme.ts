/**
 * OfficeScene Color Theme System
 *
 * Three themes: Dark (current slate), Light (bright office), Neon (cyberpunk)
 *
 * Usage:
 *   import { activeTheme, THEMES, setActiveTheme, lerpColor, ThemeName } from './office-theme'
 *
 *   // In OfficeScene, replace hardcoded colors like COLOR_BG with activeTheme.bg
 *   // Call setActiveTheme('neon') then redraw everything
 */

export type ThemeName = 'dark' | 'light' | 'neon'

export interface OfficeTheme {
  // Scene background
  bg: number
  // Room walls & floor
  roomFloor: number
  roomFloor2: number
  wall: number
  wallInner: number
  // Desk
  deskBody: number
  deskTop: number
  // Room header
  headerBg: number
  doorFrame: number
  // Office background
  officeFloor: number
  officeGrid: number
  rugFill: number
  rugStroke: number
  // Text colors (CSS hex strings for Phaser Text objects)
  headerText: string
  badgeText: string
  badgeBg: string
  nameText: string
  nameBg: string
  // Tooltip
  tooltipBg: number
  tooltipStroke: number
  tooltipText: string
  // Monitor glow
  monitorGlowActive: number
  monitorGlowIdle: number
  // Thought bubble states
  thoughtDefault: number
  thoughtWorking: number
  thoughtPlan: number
  thoughtAcceptEdits: number
  // Desk stroke states
  deskStrokeIdle: number
  deskStrokeWorking: number
  deskStrokeWaiting: number
  deskStrokeHover: number
  // Particles & screen lines
  particleColors: number[]
  screenLineColors: number[]
  // Lamp
  lampMetal: number
  lampShade: number
  // Coffee mug
  mugBody: number
  mugHandle: number
}

export const THEMES: Record<ThemeName, OfficeTheme> = {
  // ---- DARK (current slate palette) ----
  dark: {
    bg: 0x111827,
    roomFloor: 0x94a3b8,
    roomFloor2: 0x8b97a8,
    wall: 0xcbd5e1,
    wallInner: 0xe2e8f0,
    deskBody: 0x475569,
    deskTop: 0x64748b,
    headerBg: 0x1e293b,
    doorFrame: 0x3b82f6,
    officeFloor: 0x0f172a,
    officeGrid: 0x1e293b,
    rugFill: 0x1e3a5f,
    rugStroke: 0x2563eb,
    headerText: '#e2e8f0',
    badgeText: '#94a3b8',
    badgeBg: '#1e293b',
    nameText: '#e2e8f0',
    nameBg: '#0f172acc',
    tooltipBg: 0x0f172a,
    tooltipStroke: 0x334155,
    tooltipText: '#e2e8f0',
    monitorGlowActive: 0x0ea5e9,
    monitorGlowIdle: 0x94a3b8,
    thoughtDefault: 0x475569,
    thoughtWorking: 0x059669,
    thoughtPlan: 0x8b5cf6,
    thoughtAcceptEdits: 0x3b82f6,
    deskStrokeIdle: 0x64748b,
    deskStrokeWorking: 0x34d399,
    deskStrokeWaiting: 0xfbbf24,
    deskStrokeHover: 0x3b82f6,
    particleColors: [0x0ea5e9, 0x34d399, 0xffffff],
    screenLineColors: [0x0ea5e9, 0x34d399],
    lampMetal: 0x94a3b8,
    lampShade: 0xfbbf24,
    mugBody: 0x8b5cf6,
    mugHandle: 0x6d28d9,
  },

  // ---- LIGHT (bright office) ----
  light: {
    bg: 0xf1f5f9,
    roomFloor: 0xe2e8f0,
    roomFloor2: 0xd4dae3,
    wall: 0x94a3b8,
    wallInner: 0xcbd5e1,
    deskBody: 0x9ca3af,
    deskTop: 0xb0b8c4,
    headerBg: 0xf8fafc,
    doorFrame: 0x2563eb,
    officeFloor: 0xe8ecf1,
    officeGrid: 0xcbd5e1,
    rugFill: 0xc7d8f0,
    rugStroke: 0x93b4e8,
    headerText: '#1e293b',
    badgeText: '#475569',
    badgeBg: '#e2e8f0',
    nameText: '#1e293b',
    nameBg: '#ffffffcc',
    tooltipBg: 0xffffff,
    tooltipStroke: 0xcbd5e1,
    tooltipText: '#1e293b',
    monitorGlowActive: 0x2563eb,
    monitorGlowIdle: 0xcbd5e1,
    thoughtDefault: 0x94a3b8,
    thoughtWorking: 0x16a34a,
    thoughtPlan: 0x7c3aed,
    thoughtAcceptEdits: 0x2563eb,
    deskStrokeIdle: 0x94a3b8,
    deskStrokeWorking: 0x16a34a,
    deskStrokeWaiting: 0xd97706,
    deskStrokeHover: 0x2563eb,
    particleColors: [0x2563eb, 0x16a34a, 0x475569],
    screenLineColors: [0x2563eb, 0x16a34a],
    lampMetal: 0x64748b,
    lampShade: 0xf59e0b,
    mugBody: 0x7c3aed,
    mugHandle: 0x6d28d9,
  },

  // ---- NEON (cyberpunk) ----
  neon: {
    bg: 0x0a0a1a,
    roomFloor: 0x1a1a3e,
    roomFloor2: 0x15152e,
    wall: 0x2d1b69,
    wallInner: 0x3b1f8e,
    deskBody: 0x1a1a3e,
    deskTop: 0x2d2d5e,
    headerBg: 0x0d0d24,
    doorFrame: 0xff00ff,
    officeFloor: 0x08081a,
    officeGrid: 0x1a0a3a,
    rugFill: 0x1a0040,
    rugStroke: 0xff00ff,
    headerText: '#e0b0ff',
    badgeText: '#a78bfa',
    badgeBg: '#1a0a3a',
    nameText: '#e0b0ff',
    nameBg: '#0a0a1acc',
    tooltipBg: 0x0d0d24,
    tooltipStroke: 0xff00ff,
    tooltipText: '#e0b0ff',
    monitorGlowActive: 0x00ffff,
    monitorGlowIdle: 0xff00ff,
    thoughtDefault: 0x6b21a8,
    thoughtWorking: 0x00ff88,
    thoughtPlan: 0xff00ff,
    thoughtAcceptEdits: 0x00ffff,
    deskStrokeIdle: 0x6b21a8,
    deskStrokeWorking: 0x00ff88,
    deskStrokeWaiting: 0xff6600,
    deskStrokeHover: 0x00ffff,
    particleColors: [0x00ffff, 0xff00ff, 0x00ff88],
    screenLineColors: [0x00ffff, 0xff00ff],
    lampMetal: 0x6b21a8,
    lampShade: 0xff00ff,
    mugBody: 0x00ffff,
    mugHandle: 0x0088aa,
  },
}

/** The currently active theme — mutated by setActiveTheme() */
export let activeTheme: OfficeTheme = THEMES.dark

/** Current theme name */
export let currentThemeName: ThemeName = 'dark'

/** Switch the active theme (does NOT redraw — caller must trigger redraw) */
export function setActiveTheme(name: ThemeName): { oldBg: number; newBg: number } {
  const oldBg = activeTheme.bg
  currentThemeName = name
  activeTheme = THEMES[name]
  return { oldBg, newBg: activeTheme.bg }
}

/** Linearly interpolate two 0xRRGGBB hex colors; t in [0,1] */
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg_ = (b >> 8) & 0xff, bb = b & 0xff
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg_ - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  )
}
