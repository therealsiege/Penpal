/**
 * OfficeScene Color Theme System
 *
 * Two themes: Dark (deep industrial) and Light (warm studio).
 * Press T in-game to toggle.
 *
 * Usage:
 *   import { activeTheme, THEMES, setActiveTheme, lerpColor, ThemeName } from './office-theme'
 *
 *   // All rendering code references activeTheme.x — no hardcoded hex values.
 *   // Call setActiveTheme('light') then trigger redraw.
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
  // Structural metallic tones for terrain/furniture details
  metallic: number       // dark: 0x3a4a5a — steel panels, reactor body, structural metal
  metallicAlt: number    // dark: 0x4a5a6a — lighter metal, furniture legs, fixtures
  // Stage / status indicator colors
  stageExecuting: number   // orchestrator executing stage (dark: 0xf97316 orange)
  stageValidating: number  // orchestrator validating stage (dark: 0x06b6d4 cyan)
  statusWorking: number    // working/success green (dark: 0x34d399)
  statusWaiting: number    // waiting/warning amber (dark: 0xfbbf24)
  // Screen line / screensaver alternate colors
  screenPlanAlt: number    // plan-mode screen line alt (dark: 0xc4b5fd lavender)
  screensaverPurple: number // screensaver purple band (dark: 0x5b21b6)
  screensaverTeal: number  // screensaver teal band (dark: 0x0d9488)
  // Glass / translucent fill
  glassFill: number        // fish tank water, vending glass (dark: 0x082f49)
  // Seasonal leaf accent colors
  leafOrange: number       // autumn leaf orange (dark: 0xb45309)
  leafRed: number          // autumn leaf red (dark: 0xdc2626)
  leafBurnt: number        // autumn leaf burnt orange (dark: 0xea580c)
}

export const THEMES: Record<ThemeName, OfficeTheme> = {
  // ---- DARK (deep industrial palette) ----
  dark: {
    bg: 0x0a1628,
    roomFloor: 0x141a22,
    roomFloor2: 0x1a2028,
    wall: 0x1e3a5f,
    wallInner: 0x3a5a78,
    deskBody: 0x1e2830,
    deskTop: 0x2a3440,
    headerBg: 0x0a0e14,
    doorFrame: 0x00ff88,
    officeFloor: 0x0c1524,
    officeGrid: 0x152a40,
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
    fogColor: 0x0f2137,
    ventFill: 0x1a2230,
    shadowDark: 0x0a0e14,
    metallic: 0x3a4a5a,
    metallicAlt: 0x4a5a6a,
    stageExecuting: 0xf97316,
    stageValidating: 0x06b6d4,
    statusWorking: 0x34d399,
    statusWaiting: 0xfbbf24,
    screenPlanAlt: 0xc4b5fd,
    screensaverPurple: 0x5b21b6,
    screensaverTeal: 0x0d9488,
    glassFill: 0x082f49,
    leafOrange: 0xb45309,
    leafRed: 0xdc2626,
    leafBurnt: 0xea580c,
  },

  // ---- LIGHT (warm studio — cream, teal, coffee tones) ----
  light: {
    bg: 0xf5f0e8,
    roomFloor: 0xebe4d8,
    roomFloor2: 0xe0d8cc,
    wall: 0x8b9ea8,
    wallInner: 0xd4cfc6,
    deskBody: 0xb8a88e,
    deskTop: 0xc8bca6,
    headerBg: 0xf8f4ee,
    doorFrame: 0x2a8c8c,
    officeFloor: 0xeee8de,
    officeGrid: 0xddd5c8,
    rugFill: 0xd8cfc0,
    rugStroke: 0x5b9ea0,
    headerText: '#3d3229',
    badgeText: '#2a7a7a',
    badgeBg: '#ebe4d8',
    nameText: '#3d3229',
    nameBg: '#f8f4eecc',
    tooltipBg: 0xfaf7f2,
    tooltipStroke: 0xd4cfc6,
    tooltipText: '#3d3229',
    panelBg: 0xfaf7f2,
    panelStroke: 0xd4cfc6,
    separator: 0xe0d8cc,
    accentText: '#2a8c8c',
    subtleText: '#8b7e6e',
    monitorGlowActive: 0x2a8c8c,
    monitorGlowIdle: 0xd4cfc6,
    thoughtDefault: 0xa89888,
    thoughtWorking: 0x2a8c8c,
    thoughtPlan: 0x8b6bb0,
    thoughtAcceptEdits: 0x5b9ea0,
    deskStrokeIdle: 0xa89888,
    deskStrokeWorking: 0x2a8c8c,
    deskStrokeWaiting: 0xc48a3f,
    deskStrokeHover: 0x5b9ea0,
    particleColors: [0x5b9ea0, 0x8bb0a0, 0xc8bca6],
    screenLineColors: [0x5b9ea0, 0x2a8c8c],
    lampMetal: 0x8b7e6e,
    lampShade: 0xc48a3f,
    mugBody: 0xd4c4a8,
    mugHandle: 0xb8a88e,
    fogColor: 0xddd5c8,
    ventFill: 0xe0d8cc,
    shadowDark: 0xebe4d8,
    metallic: 0x8b9090,
    metallicAlt: 0x9ba0a0,
    stageExecuting: 0xc48a3f,
    stageValidating: 0x5b9ea0,
    statusWorking: 0x5a9e6f,
    statusWaiting: 0xc48a3f,
    screenPlanAlt: 0xb8a0d0,
    screensaverPurple: 0x7b5ea0,
    screensaverTeal: 0x5b9ea0,
    glassFill: 0x8baab8,
    leafOrange: 0xc07830,
    leafRed: 0xb84040,
    leafBurnt: 0xc46838,
  },

  // ---- NEON (cyberpunk — deep violet, neon magenta, electric) ----
  neon: {
    bg: 0x0a0a14,
    roomFloor: 0x0f0f1a,
    roomFloor2: 0x141424,
    wall: 0x2a1a4a,
    wallInner: 0x3a2a6a,
    deskBody: 0x160d2a,
    deskTop: 0x1e1432,
    headerBg: 0x050510,
    doorFrame: 0xff00ff,
    officeFloor: 0x0c0a18,
    officeGrid: 0x1a1228,
    rugFill: 0x160d2a,
    rugStroke: 0xff00ff,
    headerText: '#e0d0ff',
    badgeText: '#ff00ff',
    badgeBg: '#0f0f1a',
    nameText: '#e0d0ff',
    nameBg: '#050510cc',
    tooltipBg: 0x0a0a14,
    tooltipStroke: 0x2a1a4a,
    tooltipText: '#e0d0ff',
    panelBg: 0x0a0a14,
    panelStroke: 0x2a1a4a,
    separator: 0x160d2a,
    accentText: '#ff00ff',
    subtleText: '#8070a0',
    monitorGlowActive: 0xff00ff,
    monitorGlowIdle: 0x160d2a,
    thoughtDefault: 0x1e1432,
    thoughtWorking: 0xff00ff,
    thoughtPlan: 0xb060ff,
    thoughtAcceptEdits: 0xff00ff,
    deskStrokeIdle: 0x1e1432,
    deskStrokeWorking: 0xff00ff,
    deskStrokeWaiting: 0xffa040,
    deskStrokeHover: 0xff00ff,
    particleColors: [0xff00ff, 0x00ff88, 0xb060ff],
    screenLineColors: [0xff00ff, 0x00ff88],
    lampMetal: 0x2a1a4a,
    lampShade: 0xffa040,
    mugBody: 0xff00ff,
    mugHandle: 0x8a0088,
    fogColor: 0x08081a,
    ventFill: 0x160d2a,
    shadowDark: 0x05050f,
    metallic: 0x2a1a4a,
    metallicAlt: 0x3a2a5a,
    stageExecuting: 0xff6020,
    stageValidating: 0x00ffcc,
    statusWorking: 0x00ff88,
    statusWaiting: 0xffa040,
    screenPlanAlt: 0xd080ff,
    screensaverPurple: 0x8020e0,
    screensaverTeal: 0x00ccaa,
    glassFill: 0x0a0a30,
    leafOrange: 0xff8020,
    leafRed: 0xff2040,
    leafBurnt: 0xff5020,
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
