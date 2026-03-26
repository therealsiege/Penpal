// ---------------------------------------------------------------------------
// room-config-loader.ts
// Typed loader for room-config.json. Converts hex string colors to numbers
// and provides a safe getRoomTemplate() lookup with defaultTemplate fallback.
// ---------------------------------------------------------------------------

import rawConfig from './room-config.json'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomTemplateConfig {
  accentColor: number
  rugColor: number
  floorColor: number
  wallOuter: number
  wallInner: number
  headerBg: number
  doorFill: number
  props: string[]
}

export interface SharedColors {
  dropShadow: number
  floorGridLine: number
  floorBolt: number
  statusStrip: number
  doorHandle: number
  activityBar: number
  waitingBar: number
  heatOverlay: number
  ventBody: number
  ventLouver: number
  ventBorder: number
  windowFrame: number
  curtainRod: number
  curtainPanel: number
  windowSkySunny: number
  windowSunDot: number
  windowHillDay: number
  windowSkyNight: number
  windowStar: number
  windowMoon: number
  windowSkyEvening: number
  windowHillEvening: number
}

export interface RoomConfig {
  templates: Record<string, RoomTemplateConfig>
  defaultTemplate: string
  shared: SharedColors
}

// ---------------------------------------------------------------------------
// Hex string → number conversion
// ---------------------------------------------------------------------------

function hexToNumber(value: string): number {
  return parseInt(value.replace('0x', ''), 16)
}

function convertTemplateColors(raw: Record<string, unknown>): RoomTemplateConfig {
  return {
    accentColor: hexToNumber(raw.accentColor as string),
    rugColor:    hexToNumber(raw.rugColor as string),
    floorColor:  hexToNumber(raw.floorColor as string),
    wallOuter:   hexToNumber(raw.wallOuter as string),
    wallInner:   hexToNumber(raw.wallInner as string),
    headerBg:    hexToNumber(raw.headerBg as string),
    doorFill:    hexToNumber(raw.doorFill as string),
    props:       raw.props as string[],
  }
}

function convertSharedColors(raw: Record<string, unknown>): SharedColors {
  const result = {} as SharedColors
  for (const key of Object.keys(raw)) {
    ;(result as Record<string, number>)[key] = hexToNumber(raw[key] as string)
  }
  return result
}

// ---------------------------------------------------------------------------
// Build the typed config once at module load time
// ---------------------------------------------------------------------------

const _templates: Record<string, RoomTemplateConfig> = {}
for (const [type, raw] of Object.entries(rawConfig.templates)) {
  _templates[type] = convertTemplateColors(raw as Record<string, unknown>)
}

const _shared: SharedColors = convertSharedColors(
  rawConfig.shared as Record<string, unknown>,
)

const _defaultTemplate = rawConfig.defaultTemplate

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the typed RoomTemplateConfig for the given room type string.
 * Falls back to the defaultTemplate defined in room-config.json if the type
 * is not found. Never returns undefined.
 */
export function getRoomTemplate(roomType: string): RoomTemplateConfig {
  return _templates[roomType] ?? _templates[_defaultTemplate]
}

/**
 * Shared color values used across all room types (door handle, activity bars,
 * heat overlay, vent grates, window scenery, etc.).
 */
export const sharedColors: SharedColors = _shared

/**
 * Full typed room config object for consumers that need bulk access.
 */
export const roomConfig: RoomConfig = {
  templates: _templates,
  defaultTemplate: _defaultTemplate,
  shared: _shared,
}
