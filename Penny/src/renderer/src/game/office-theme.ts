/**
 * OfficeScene Color Theme System
 *
 * Two themes: Dark (FF7 Midgar industrial) and Light (bright office).
 * Press T in-game to toggle.
 *
 * Usage:
 *   import { activeTheme, THEMES, setActiveTheme, lerpColor, ThemeName } from './office-theme'
 *
 *   // All rendering code references activeTheme.x — no hardcoded hex values.
 *   // Call setActiveTheme('light') then trigger redraw.
 */

export type ThemeName = 'dark' | 'light'

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
  // Tooltip / panel UI
  tooltipBg: number
  tooltipStroke: number
  tooltipText: string
  panelBg: number        // HUD panels, speech bubbles, overlays (dark: 0x0c1018)
  panelStroke: number    // panel borders, divider lines (dark: 0x2a3440)
  separator: number      // separator bars, hall edges (dark: 0x1e2830)
  accentText: string     // bright accent label color CSS (dark: '#00e5ff')
  subtleText: string     // muted secondary text CSS (dark: '#8a96a4')
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
  // Atmosphere / terrain
  fogColor: number       // atmosphere fog / sky base (dark: 0x141a22)
  ventFill: number       // vent dark fill, industrial detail (dark: 0x1a2230)
  shadowDark: number     // deep shadow tint (dark: 0x0a0e14)
}

export const THEMES: Record<ThemeName, OfficeTheme> = {
  // ---- DARK (FF7 Midgar industrial palette) ----
  dark: {
    bg: 0x0a0e14,
    roomFloor: 0x141a22,
    roomFloor2: 0x1a2028,
    wall: 0x2a3440,
    wallInner: 0x3a4858,
    deskBody: 0x1e2830,
    deskTop: 0x2a3440,
    headerBg: 0x0a0e14,
    doorFrame: 0x00ff88,
    officeFloor: 0x0c1018,
    officeGrid: 0x1a2230,
    rugFill: 0x141a22,
    rugStroke: 0x00ff88,
    headerText: '#c4ccd6',
    badgeText: '#00e5ff',
    badgeBg: '#141a22',
    nameText: '#c4ccd6',
    nameBg: '#0a0e14cc',
    tooltipBg: 0x0c1018,
    tooltipStroke: 0x2a3440,
    tooltipText: '#c4ccd6',
    panelBg: 0x0c1018,
    panelStroke: 0x2a3440,
    separator: 0x1e2830,
    accentText: '#00e5ff',
    subtleText: '#8a96a4',
    monitorGlowActive: 0x00e5ff,
    monitorGlowIdle: 0x1e2830,
    thoughtDefault: 0x2a3440,
    thoughtWorking: 0x00e5ff,
    thoughtPlan: 0xa78bfa,
    thoughtAcceptEdits: 0x00e5ff,
    deskStrokeIdle: 0x2a3440,
    deskStrokeWorking: 0x00e5ff,
    deskStrokeWaiting: 0xd4a017,
    deskStrokeHover: 0x00e5ff,
    particleColors: [0x00e5ff, 0x00ff88, 0xffffff],
    screenLineColors: [0x00e5ff, 0x00ff88],
    lampMetal: 0x3a4858,
    lampShade: 0xd4a017,
    mugBody: 0x00e5ff,
    mugHandle: 0x007a8a,
    fogColor: 0x141a22,
    ventFill: 0x1a2230,
    shadowDark: 0x0a0e14,
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
    panelBg: 0xffffff,
    panelStroke: 0xcbd5e1,
    separator: 0xd4dae3,
    accentText: '#2563eb',
    subtleText: '#64748b',
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
    fogColor: 0xcbd5e1,
    ventFill: 0xd4dae3,
    shadowDark: 0xe2e8f0,
  },

}

/** The currently active theme — mutated by setActiveTheme() */
export let activeTheme: OfficeTheme = THEMES.dark

/** Switch the active theme (does NOT redraw — caller must trigger redraw) */
export function setActiveTheme(name: ThemeName): { oldBg: number; newBg: number } {
  const oldBg = activeTheme.bg
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
