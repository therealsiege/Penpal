/**
 * NavMesh — Grid-based navigation for the office scene.
 *
 * Strategy: Everything is BLOCKED by default. Only these are walkable:
 *   1. Room interiors (tightly inset from walls)
 *   2. Door openings (narrow strip connecting room to corridor)
 *   3. Corridors (from corridorSegments data — the actual drawn hallways)
 *   4. Café interior
 *   5. A narrow path connecting the lowest corridor to the café
 *
 * Walls, space between rooms, and the building floor itself are NOT walkable.
 * Agents MUST go through doors and corridors.
 */

export interface NavPoint {
  x: number
  y: number
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
    rooms: Array<{
      x: number; y: number; width: number; height: number
      doorX: number; doorY: number
    }>
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

    const WALL_INSET = 14

    // 1. Room interiors only (tight inset so walls stay blocked)
    for (const room of config.rooms) {
      const rx = room.x - room.width / 2 + WALL_INSET
      const ry = room.y - room.height / 2 + WALL_INSET + 20
      const rw = room.width - WALL_INSET * 2
      const rh = room.height - WALL_INSET * 2 - 20
      if (rw > 0 && rh > 0) this.markRect(rx, ry, rw, rh)
    }

    // 2. Door openings — narrow passage through the wall
    for (const room of config.rooms) {
      this.markRect(room.doorX - 10, room.y + room.height / 2 - 16, 20, 32)
    }

    // 3. Corridors — ONLY the actual drawn hallway segments
    for (const seg of config.corridorSegments) {
      const isH = Math.abs(seg.y1 - seg.y2) < CELL_SIZE
      if (isH) {
        const x1 = Math.min(seg.x1, seg.x2) - 4
        const x2 = Math.max(seg.x1, seg.x2) + 4
        this.markRect(x1, seg.y1 - 8, x2 - x1, 16)
      } else {
        const y1 = Math.min(seg.y1, seg.y2) - 4
        const y2 = Math.max(seg.y1, seg.y2) + 4
        this.markRect(seg.x1 - 8, y1, 16, y2 - y1)
      }
    }

    // 4. Café interior
    if (config.cafeBounds) {
      const cb = config.cafeBounds
      this.markRect(cb.x + 4, cb.y + 4, cb.w - 8, cb.h - 8)

      // 5. Narrow path from lowest corridor to café
      // Find the lowest (max Y) corridor endpoint
      let lowestCorridorY = 0
      let lowestCorridorX = cb.x + cb.w / 2
      for (const seg of config.corridorSegments) {
        const maxSegY = Math.max(seg.y1, seg.y2)
        if (maxSegY > lowestCorridorY) {
          lowestCorridorY = maxSegY
          // Use the X that's closest to the café
          lowestCorridorX = Math.abs(seg.x1 - cb.x) < Math.abs(seg.x2 - cb.x) ? seg.x1 : seg.x2
        }
      }

      // Draw a narrow L-shaped path: corridor → down → across → café
      if (lowestCorridorY > 0) {
        const pathWidth = 16
        // Vertical leg down from corridor to café Y
        const legTopY = lowestCorridorY - 4
        const legBotY = cb.y + cb.h / 2
        this.markRect(lowestCorridorX - pathWidth / 2, legTopY, pathWidth, Math.max(0, legBotY - legTopY))
        // Horizontal leg from corridor X to café X
        const leftX = Math.min(lowestCorridorX, cb.x + cb.w / 2)
        const rightX = Math.max(lowestCorridorX, cb.x + cb.w / 2)
        this.markRect(leftX - 4, legBotY - pathWidth / 2, rightX - leftX + 8, pathWidth)
      }
    }
  }

  findPath(start: NavPoint, end: NavPoint): NavPoint[] | null {
    if (this.gridW === 0) return [end]

    let sg = this.clamp(this.toGrid(start.x, start.y))
    let eg = this.clamp(this.toGrid(end.x, end.y))

    if (!this.grid[sg.gy]?.[sg.gx]) {
      const s = this.snapWalkable(sg.gx, sg.gy); if (!s) return [end]; sg = s
    }
    if (!this.grid[eg.gy]?.[eg.gx]) {
      const s = this.snapWalkable(eg.gx, eg.gy); if (!s) return [end]; eg = s
    }

    // A*
    const open: AStarNode[] = []
    const best = new Map<number, number>()
    const k = (x: number, y: number) => y * this.gridW + x
    const closed = new Set<number>()

    const h = (ax: number, ay: number) => {
      const dx = Math.abs(ax - eg.gx), dy = Math.abs(ay - eg.gy)
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy)
    }

    const s: AStarNode = { gx: sg.gx, gy: sg.gy, g: 0, h: h(sg.gx, sg.gy), f: 0, parent: null }
    s.f = s.h; open.push(s); best.set(k(sg.gx, sg.gy), 0)

    let iters = 0
    while (open.length > 0 && iters++ < 4000) {
      let bi = 0
      for (let i = 1; i < open.length; i++) { if (open[i].f < open[bi].f) bi = i }
      const cur = open.splice(bi, 1)[0]
      const ck = k(cur.gx, cur.gy)

      if (cur.gx === eg.gx && cur.gy === eg.gy) return this.buildPath(cur, start, end)
      closed.add(ck)

      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const nx = cur.gx + dx, ny = cur.gy + dy, nk = k(nx, ny)
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue
        if (!this.grid[ny][nx] || closed.has(nk)) continue
        // No corner-cutting through walls
        if (dx !== 0 && dy !== 0 && (!this.grid[cur.gy][cur.gx + dx] || !this.grid[cur.gy + dy][cur.gx])) continue

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
    return [end]
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
  private snapWalkable(gx: number, gy: number) {
    for (let r = 1; r <= 20; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const nx = gx + dx, ny = gy + dy
          if (nx >= 0 && nx < this.gridW && ny >= 0 && ny < this.gridH && this.grid[ny][nx])
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
