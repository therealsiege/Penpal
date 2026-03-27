/**
 * NavMesh — Grid-based navigation for the office scene.
 *
 * Strategy: Everything is BLOCKED by default. Base grid walkable areas:
 *   1. Corridors (from corridorSegments — the actual drawn hallways)
 *   2. Café interior + L-path to nearest corridor
 *
 * Room interiors AND door openings are NOT in the base grid.
 * Each findPath() call adds the agent's own room + door zone as
 * temporarily walkable via ownRoomRect, which extends 32px above
 * the room to overlap with the corridor. This prevents agents from
 * pathing through other rooms' doors as shortcuts.
 */

import { ROOM_HEADER_H } from './office-constants'

export interface NavPoint {
  x: number
  y: number
}

export interface NavRect {
  x: number
  y: number
  w: number
  h: number
}

interface AStarNode {
  gx: number
  gy: number
  g: number
  h: number
  f: number
  parent: AStarNode | null
}

const CELL_SIZE = 12

export class NavMesh {
  private grid: boolean[][] = []
  private gridW = 0
  private gridH = 0
  private originX = 0
  private originY = 0

  rebuild(config: {
    buildingBounds: { x: number; y: number; w: number; h: number } | null
    corridorSegments: Array<{ x1: number; y1: number; x2: number; y2: number }>
    cafeBounds: { x: number; y: number; w: number; h: number } | null
  }): void {
    if (!config.buildingBounds) {
      this.grid = []; this.gridW = 0; this.gridH = 0; return
    }

    const b = config.buildingBounds
    let minX = b.x - 40, minY = b.y - 40
    let maxX = b.x + b.w + 40, maxY = b.y + b.h + 100
    if (config.cafeBounds) {
      const cb = config.cafeBounds
      minX = Math.min(minX, cb.x - 20); minY = Math.min(minY, cb.y - 20)
      maxX = Math.max(maxX, cb.x + cb.w + 20); maxY = Math.max(maxY, cb.y + cb.h + 20)
    }

    this.originX = minX; this.originY = minY
    this.gridW = Math.ceil((maxX - minX) / CELL_SIZE)
    this.gridH = Math.ceil((maxY - minY) / CELL_SIZE)

    // Everything BLOCKED
    this.grid = Array.from({ length: this.gridH }, () => new Array(this.gridW).fill(false))

    // 1. Corridors — mark walkable hallway segments
    const CORR_W = 48 // walkable width for corridors (matches sidewalk visual: HALL_H*3=36 + margin)
    const CORR_PAD = 6 // extra length past endpoints
    for (const seg of config.corridorSegments) {
      const dx = Math.abs(seg.x1 - seg.x2)
      const dy = Math.abs(seg.y1 - seg.y2)
      if (dx >= dy) {
        const x1 = Math.min(seg.x1, seg.x2) - CORR_PAD
        const x2 = Math.max(seg.x1, seg.x2) + CORR_PAD
        this.markRect(x1, (seg.y1 + seg.y2) / 2 - CORR_W / 2, x2 - x1, CORR_W)
      } else {
        const y1 = Math.min(seg.y1, seg.y2) - CORR_PAD
        const y2 = Math.max(seg.y1, seg.y2) + CORR_PAD
        this.markRect((seg.x1 + seg.x2) / 2 - CORR_W / 2, y1, CORR_W, y2 - y1)
      }
      // Junction blob at each endpoint for reliable connectivity
      this.markRect(seg.x1 - CORR_W / 2, seg.y1 - CORR_W / 2, CORR_W, CORR_W)
      this.markRect(seg.x2 - CORR_W / 2, seg.y2 - CORR_W / 2, CORR_W, CORR_W)
    }

    // 2. Café interior + connector to nearest corridor
    if (config.cafeBounds) {
      const cb = config.cafeBounds
      this.markRect(cb.x + 4, cb.y + 4, cb.w - 8, cb.h - 8)

      const cafeCX = cb.x + cb.w / 2
      const cafeCY = cb.y + cb.h / 2
      let nearestDist = Infinity
      let nearestX = cafeCX
      let nearestY = cafeCY
      for (const seg of config.corridorSegments) {
        for (const pt of [
          { x: seg.x1, y: seg.y1 },
          { x: seg.x2, y: seg.y2 },
          { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 },
        ]) {
          const d = Math.hypot(pt.x - cafeCX, pt.y - cafeCY)
          if (d < nearestDist) {
            nearestDist = d
            nearestX = pt.x
            nearestY = pt.y
          }
        }
      }
      if (nearestDist < Infinity && nearestDist > 0) {
        const pathWidth = 48
        const minY = Math.min(nearestY, cafeCY)
        const maxY = Math.max(nearestY, cafeCY)
        const minX = Math.min(nearestX, cafeCX)
        const maxX = Math.max(nearestX, cafeCX)
        this.markRect(nearestX - pathWidth / 2, minY - 4, pathWidth, maxY - minY + 8)
        this.markRect(minX - 4, cafeCY - pathWidth / 2, maxX - minX + 8, pathWidth)
      }
    }

    // Room interiors and door openings are NOT in the base grid.
    // findPath() adds the agent's own room + door zone via ownRoomRect.
  }

  findPath(start: NavPoint, end: NavPoint, ownRoomRect?: NavRect): NavPoint[] | null {
    if (this.gridW === 0) return null

    // Pre-compute the agent's own room + door zone as ADDITIONAL walkable area.
    // The base grid has corridors + cafe only. The ownRoomRect extends above
    // the room to overlap with the corridor, bridging room → door → corridor.
    let ownCells: Set<number> | null = null
    const k = (x: number, y: number) => y * this.gridW + x
    if (ownRoomRect) {
      ownCells = new Set<number>()
      const a = this.clamp(this.toGrid(ownRoomRect.x, ownRoomRect.y))
      const b = this.clamp(this.toGrid(ownRoomRect.x + ownRoomRect.w, ownRoomRect.y + ownRoomRect.h))
      for (let ey = a.gy; ey <= b.gy; ey++)
        for (let ex = a.gx; ex <= b.gx; ex++)
          ownCells.add(k(ex, ey))
    }

    const isWalkable = (gx: number, gy: number) =>
      this.grid[gy]?.[gx] || (ownCells !== null && ownCells.has(k(gx, gy)))

    let sg = this.clamp(this.toGrid(start.x, start.y))
    let eg = this.clamp(this.toGrid(end.x, end.y))

    if (!isWalkable(sg.gx, sg.gy)) {
      const s = this.snapWalkableWith(sg.gx, sg.gy, ownCells, k); if (!s) return null; sg = s
    }
    if (!isWalkable(eg.gx, eg.gy)) {
      const s = this.snapWalkableWith(eg.gx, eg.gy, ownCells, k); if (!s) return null; eg = s
    }

    // A*
    const open: AStarNode[] = []
    const best = new Map<number, number>()
    const closed = new Set<number>()

    const h = (ax: number, ay: number) => {
      const dx = Math.abs(ax - eg.gx), dy = Math.abs(ay - eg.gy)
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy)
    }

    const s: AStarNode = { gx: sg.gx, gy: sg.gy, g: 0, h: h(sg.gx, sg.gy), f: 0, parent: null }
    s.f = s.h; open.push(s); best.set(k(sg.gx, sg.gy), 0)

    let iters = 0
    while (open.length > 0 && iters++ < 20000) {
      let bi = 0
      for (let i = 1; i < open.length; i++) { if (open[i].f < open[bi].f) bi = i }
      const cur = open.splice(bi, 1)[0]
      const ck = k(cur.gx, cur.gy)

      if (cur.gx === eg.gx && cur.gy === eg.gy) return this.buildPath(cur, start, end)
      closed.add(ck)

      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const nx = cur.gx + dx, ny = cur.gy + dy, nk = k(nx, ny)
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue
        if (closed.has(nk)) continue
        if (!isWalkable(nx, ny)) continue
        // No corner-cutting through walls
        if (dx !== 0 && dy !== 0 && (!isWalkable(cur.gx + dx, cur.gy) || !isWalkable(cur.gx, cur.gy + dy))) continue

        const g = cur.g + (dx !== 0 && dy !== 0 ? 1.414 : 1)
        const prev = best.get(nk)
        if (prev !== undefined && g >= prev) continue
        best.set(nk, g)

        const ei = open.findIndex(n => n.gx === nx && n.gy === ny)
        if (ei >= 0) open.splice(ei, 1)
        const nh = h(nx, ny)
        open.push({ gx: nx, gy: ny, g, h: nh, f: g + nh, parent: cur })
      }
    }
    return null
  }

  isPointWalkable(x: number, y: number): boolean {
    const g = this.toGrid(x, y)
    return g.gx >= 0 && g.gx < this.gridW && g.gy >= 0 && g.gy < this.gridH && this.grid[g.gy][g.gx]
  }

  // ── Debug: dump walkable cells count ──
  getStats(): { gridW: number; gridH: number; walkable: number; total: number } {
    let walkable = 0
    for (let y = 0; y < this.gridH; y++)
      for (let x = 0; x < this.gridW; x++)
        if (this.grid[y][x]) walkable++
    return { gridW: this.gridW, gridH: this.gridH, walkable, total: this.gridW * this.gridH }
  }

  private markRect(wx: number, wy: number, w: number, h: number): void {
    const a = this.toGrid(wx, wy), b = this.toGrid(wx + w, wy + h)
    for (let y = Math.max(0, a.gy); y <= Math.min(this.gridH - 1, b.gy); y++)
      for (let x = Math.max(0, a.gx); x <= Math.min(this.gridW - 1, b.gx); x++)
        this.grid[y][x] = true
  }

  private toGrid(wx: number, wy: number) {
    return { gx: Math.floor((wx - this.originX) / CELL_SIZE), gy: Math.floor((wy - this.originY) / CELL_SIZE) }
  }
  private toWorld(gx: number, gy: number): NavPoint {
    return { x: this.originX + gx * CELL_SIZE + CELL_SIZE / 2, y: this.originY + gy * CELL_SIZE + CELL_SIZE / 2 }
  }
  private clamp(p: { gx: number; gy: number }) {
    return { gx: Math.max(0, Math.min(this.gridW - 1, p.gx)), gy: Math.max(0, Math.min(this.gridH - 1, p.gy)) }
  }
  private snapWalkableWith(
    gx: number, gy: number,
    ownCells: Set<number> | null,
    k: (x: number, y: number) => number,
  ) {
    for (let r = 1; r <= 20; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const nx = gx + dx, ny = gy + dy
          if (nx >= 0 && nx < this.gridW && ny >= 0 && ny < this.gridH &&
              (this.grid[ny][nx] || (ownCells !== null && ownCells.has(k(nx, ny)))))
            return { gx: nx, gy: ny }
        }
    return null
  }

  private buildPath(end: AStarNode, ws: NavPoint, we: NavPoint): NavPoint[] {
    const raw: NavPoint[] = []
    let c: AStarNode | null = end
    while (c) { raw.unshift(this.toWorld(c.gx, c.gy)); c = c.parent }
    if (raw.length > 0) raw[0] = ws
    if (raw.length > 1) raw[raw.length - 1] = we
    // Simplify collinear
    if (raw.length <= 2) return raw
    const out: NavPoint[] = [raw[0]]
    for (let i = 1; i < raw.length - 1; i++) {
      const p = out[out.length - 1], n = raw[i + 1]
      if (Math.sign(raw[i].x - p.x) !== Math.sign(n.x - raw[i].x) ||
          Math.sign(raw[i].y - p.y) !== Math.sign(n.y - raw[i].y))
        out.push(raw[i])
    }
    out.push(raw[raw.length - 1])
    return out
  }
}

/**
 * Build a NavRect for the agent's own room + door zone.
 * Extends 32px above the room top so it overlaps with the corridor,
 * bridging room interior → door → corridor without marking other
 * rooms' doors in the shared base grid.
 */
export function buildOwnRoomRect(
  room: { x: number; y: number; width: number; height: number },
): NavRect {
  const WALL_INSET = 14
  const DOOR_EXTEND = 32 // extend above room to overlap corridor
  return {
    x: room.x - room.width / 2 + WALL_INSET,
    y: room.y - room.height / 2 - DOOR_EXTEND,
    w: room.width - WALL_INSET * 2,
    h: room.height - WALL_INSET - ROOM_HEADER_H + DOOR_EXTEND,
  }
}
