// ---------------------------------------------------------------------------
// Reference lab footprint (CcpOD_-style): main hall + bottom L wings.
// Shared by floor drawing and prop anchoring.
// ---------------------------------------------------------------------------

export type LabRegionId = 'main' | 'wingL' | 'wingR'

export interface LabRegion {
  id: LabRegionId
  x: number
  y: number
  w: number
  h: number
}

/**
 * Main hall on top (~58% height), bottom split into left (~42% width) + right wings.
 * Falls back to a single rectangle when too small.
 */
export function computeReferenceLabRegions(uniX: number, uniY: number, uniW: number, uniH: number): LabRegion[] {
  if (uniW < 100 || uniH < 64) {
    return [{ id: 'main', x: uniX, y: uniY, w: uniW, h: uniH }]
  }
  const mainH = Math.max(48, Math.floor(uniH * 0.58))
  const subH = uniH - mainH
  if (subH < 20) {
    return [{ id: 'main', x: uniX, y: uniY, w: uniW, h: uniH }]
  }
  const leftW = Math.max(40, Math.floor(uniW * 0.42))
  const rightW = uniW - leftW
  const rightX = uniX + leftW
  const out: LabRegion[] = [{ id: 'main', x: uniX, y: uniY, w: uniW, h: mainH }]
  // If the right bay would be too narrow, use one full-width bottom wing (no hole).
  const splitBottom = rightW >= 36
  const wingLW = splitBottom ? leftW : uniW
  out.push({ id: 'wingL', x: uniX, y: uniY + mainH, w: wingLW, h: subH })
  if (splitBottom) {
    out.push({ id: 'wingR', x: rightX, y: uniY + mainH, w: rightW, h: subH })
  }
  return out
}

export function findLabRegion(regions: LabRegion[], id: LabRegionId): LabRegion | undefined {
  return regions.find(r => r.id === id)
}
