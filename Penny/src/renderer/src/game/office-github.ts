import Phaser from 'phaser'
import type { GitHubIssueCard } from '../types'
import {
  GITHUB_BUILDING_W,
  GITHUB_BUILDING_H,
  GITHUB_POLL_MS,
  LOD_L1_MAX,
  LOD_L2_MAX,
} from './office-constants'
import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Host interface
// ---------------------------------------------------------------------------

export interface GitHubBuildingHostScene extends Phaser.Scene {
  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALL_OUTER = 3
const WALL_INNER = 1
const HEADER_H = 28
const TAB_BAR_H = 16
const COLUMN_HEADER_H = 14
const BOTTOM_BAR_H = 16
const CARD_W = 68
const CARD_H = 24
const CARD_RADIUS = 4
const CARD_PAD = 3
const MAX_VISIBLE_CARDS = 12
const COLUMN_COUNT = 6
const COLUMN_GAP = 2
const TAB_ROTATE_MS = 6000

const COLUMNS: { key: string; label: string; color: number }[] = [
  { key: 'queued',     label: 'Queued',     color: 0x64748b },
  { key: 'assigned',   label: 'Assign',     color: 0x3b82f6 },
  { key: 'executing',  label: 'Exec',       color: 0xa855f7 },
  { key: 'validating', label: 'Valid',      color: 0xf59e0b },
  { key: 'done',       label: 'Done',       color: 0x22c55e },
  { key: 'failed',     label: 'Fail',       color: 0xef4444 },
]

const PRIORITY_COLORS: Record<string, number> = {
  critical: 0xef4444,
  high:     0xf59e0b,
  normal:   0x3b82f6,
  low:      0x64748b,
}

function cardColumnIndex(card: GitHubIssueCard): number {
  const s = card.taskStatus
  const stage = card.taskStage
  if (s === 'done' || s === 'completed') return 4
  if (s === 'failed' || s === 'error' || s === 'cancelled') return 5
  if (s === 'assigned') return 1
  if (s === 'active' || s === 'running') {
    if (stage === 'validating' || stage === 'reviewing') return 3
    if (stage === 'executing' || stage === 'working') return 2
    if (stage === 'planning') return 2
    return 2
  }
  return 0
}

function repoShortName(repo: string): string {
  const parts = repo.split('/')
  return parts[parts.length - 1] || repo
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardVisual {
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Graphics
  priorityBar: Phaser.GameObjects.Rectangle
  numberText: Phaser.GameObjects.Text
  titleText: Phaser.GameObjects.Text
  agentDot: Phaser.GameObjects.Arc
  cardData: GitHubIssueCard | null
  columnIdx: number
}

interface TabVisual {
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  dot: Phaser.GameObjects.Arc
  countText: Phaser.GameObjects.Text
  repo: string
}

// ---------------------------------------------------------------------------
// GitHubBuilding
// ---------------------------------------------------------------------------

export class GitHubBuilding {
  private scene: GitHubBuildingHostScene
  private root: Phaser.GameObjects.Container | null = null
  private statusLed: Phaser.GameObjects.Arc | null = null
  private statusLedTween: Phaser.Tweens.Tween | null = null
  private columnHeaders: Phaser.GameObjects.Text[] = []
  private columnCountBadges: Phaser.GameObjects.Text[] = []
  private cardPool: CardVisual[] = []
  private overflowBadges: Phaser.GameObjects.Text[] = []

  private tabs: TabVisual[] = []
  private tabContainer: Phaser.GameObjects.Container | null = null
  private activeRepoIdx = 0
  private repoList: string[] = []
  private tabRotateTimer: Phaser.Time.TimerEvent | null = null
  private tabPinned = false

  private lodL2Container: Phaser.GameObjects.Container | null = null
  private lodL3Container: Phaser.GameObjects.Container | null = null

  private lastPollAt = -Infinity
  private lastCards: GitHubIssueCard[] = []
  private lastCardFingerprint = ''
  private buildX = 0
  private buildY = 0
  private currentLod = -1
  private activityLedPulse: Phaser.Tweens.Tween | null = null

  private outlineRect: Phaser.GameObjects.Rectangle | null = null
  private outlineLabel: Phaser.GameObjects.Text | null = null

  constructor(scene: GitHubBuildingHostScene) {
    this.scene = scene
  }

  get width(): number { return GITHUB_BUILDING_W }
  get height(): number { return GITHUB_BUILDING_H }

  build(cx: number, cy: number): void {
    if (this.root && this.buildX === cx && this.buildY === cy) return
    this.destroyAll()

    const scene = this.scene
    this.buildX = cx
    this.buildY = cy
    const inset = WALL_OUTER + WALL_INNER

    this.root = scene.add.container(cx - GITHUB_BUILDING_W / 2, cy - GITHUB_BUILDING_H / 2).setDepth(2)

    // L1 outline
    this.outlineRect = scene.add.rectangle(cx, cy, GITHUB_BUILDING_W, GITHUB_BUILDING_H, 0x1e293b, 0.6)
      .setStrokeStyle(2, 0x7c3aed, 0.7).setDepth(1)
    this.outlineLabel = scene.add.text(cx, cy, 'GITHUB', {
      fontSize: '14px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#a78bfa', resolution: 2,
    }).setOrigin(0.5).setDepth(1).setAlpha(0)

    // L2/L3 containers
    this.lodL2Container = scene.add.container(0, 0)
    this.lodL3Container = scene.add.container(0, 0)
    this.root.add([this.lodL2Container, this.lodL3Container])

    // Shell (L2)
    const g = scene.add.graphics()
    this.lodL2Container.add(g)
    g.fillStyle(0x334155, 1)
    g.fillRoundedRect(0, 0, GITHUB_BUILDING_W, GITHUB_BUILDING_H, 6)
    g.fillStyle(0x1e293b, 1)
    g.fillRoundedRect(inset, inset, GITHUB_BUILDING_W - 2 * inset, GITHUB_BUILDING_H - 2 * inset, 4)
    g.fillStyle(0x0f172a, 0.9)
    g.fillRoundedRect(inset, inset, GITHUB_BUILDING_W - 2 * inset, HEADER_H, { tl: 4, tr: 4, bl: 0, br: 0 })
    g.lineStyle(2, 0x7c3aed, 0.6)
    g.lineBetween(inset, inset + HEADER_H, GITHUB_BUILDING_W - inset, inset + HEADER_H)
    const tabBarY = inset + HEADER_H
    g.fillStyle(0x0f172a, 0.5)
    g.fillRect(inset, tabBarY, GITHUB_BUILDING_W - 2 * inset, TAB_BAR_H)
    g.lineStyle(1, 0x334155, 0.3)
    g.lineBetween(inset, tabBarY + TAB_BAR_H, GITHUB_BUILDING_W - inset, tabBarY + TAB_BAR_H)
    const bottomBarY = GITHUB_BUILDING_H - inset - BOTTOM_BAR_H
    g.fillStyle(0x0f172a, 0.7)
    g.fillRect(inset, bottomBarY, GITHUB_BUILDING_W - 2 * inset, BOTTOM_BAR_H)

    // Header (L3)
    const octoY = inset + HEADER_H / 2
    const octoG = scene.add.graphics()
    octoG.fillStyle(0xf8fafc, 0.7)
    octoG.fillCircle(20, octoY, 7)
    octoG.fillTriangle(14, octoY - 5, 17, octoY - 9, 19, octoY - 4)
    octoG.fillTriangle(26, octoY - 5, 23, octoY - 9, 21, octoY - 4)
    octoG.fillStyle(0x0f172a, 1)
    octoG.fillCircle(18, octoY - 1, 1.5)
    octoG.fillCircle(22, octoY - 1, 1.5)
    this.lodL3Container.add(octoG)

    this.lodL3Container.add(scene.add.text(34, octoY, 'GITHUB DISPATCH', {
      fontSize: '12px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#e2e8f0', resolution: 2,
    }).setOrigin(0, 0.5))

    this.statusLed = scene.add.circle(GITHUB_BUILDING_W - 16, octoY, 4, 0x22c55e, 0.8)
    this.lodL3Container.add(this.statusLed)

    // Tab container (L3)
    this.tabContainer = scene.add.container(0, 0)
    this.lodL3Container.add(this.tabContainer)

    // Column headers + separators
    const colAreaTop = tabBarY + TAB_BAR_H + 2
    const colAreaW = GITHUB_BUILDING_W - 2 * inset
    const colW = (colAreaW - (COLUMN_COUNT - 1) * COLUMN_GAP) / COLUMN_COUNT
    const colStartX = inset
    const sepG = scene.add.graphics()
    this.lodL2Container.add(sepG)

    for (let i = 0; i < COLUMN_COUNT; i++) {
      const cx2 = colStartX + i * (colW + COLUMN_GAP) + colW / 2

      const hdr = scene.add.text(cx2, colAreaTop + COLUMN_HEADER_H / 2, COLUMNS[i].label, {
        fontSize: '7px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
        color: '#94a3b8', resolution: 2,
      }).setOrigin(0.5)
      this.columnHeaders.push(hdr)
      this.lodL3Container.add(hdr)

      const badge = scene.add.text(cx2, colAreaTop + COLUMN_HEADER_H / 2, '0', {
        fontSize: '9px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
        color: '#64748b', resolution: 2,
      }).setOrigin(0.5).setAlpha(0)
      this.columnCountBadges.push(badge)
      this.lodL2Container.add(badge)

      if (i > 0) {
        const sepX = colStartX + i * (colW + COLUMN_GAP) - COLUMN_GAP / 2
        sepG.lineStyle(1, 0x475569, 0.3)
        let dy = colAreaTop
        while (dy < bottomBarY) {
          sepG.lineBetween(sepX, dy, sepX, Math.min(dy + 4, bottomBarY))
          dy += 7
        }
      }

      const overflow = scene.add.text(cx2, bottomBarY - 5, '', {
        fontSize: '7px', fontFamily: 'system-ui, sans-serif',
        color: '#94a3b8', backgroundColor: '#1e293bcc',
        padding: { x: 2, y: 1 }, resolution: 2,
      }).setOrigin(0.5).setAlpha(0)
      this.overflowBadges.push(overflow)
      this.lodL3Container.add(overflow)
    }

    // Card pool (L3)
    for (let i = 0; i < MAX_VISIBLE_CARDS; i++) {
      const card = this.createCardVisual()
      card.container.setAlpha(0)
      this.cardPool.push(card)
      this.lodL3Container.add(card.container)
    }

    this.startLedPulse()
    this.startTabRotation()

    // Force LOD to full detail
    this.currentLod = -1
    this.applyLod(1.0)
  }

  tick(time: number): void {
    if (!this.root) return
    if (time - this.lastPollAt < GITHUB_POLL_MS) return
    this.lastPollAt = time

    window.api.githubIssueCards().then(cards => {
      if (!Array.isArray(cards)) return
      const fp = JSON.stringify(cards.map(c => `${c.taskId}:${c.taskStatus}:${c.taskStage}`))
      if (fp === this.lastCardFingerprint) return
      this.lastCardFingerprint = fp

      const prevMap = new Map(this.lastCards.map(c => [c.taskId, c]))
      this.lastCards = cards
      this.rebuildTabs(cards)
      this.updateVisibleBoard(cards, prevMap)
      this.updateActivityLed(cards)
    }).catch(() => {})
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    if (!this.root) return { x: 0, y: 0, w: 0, h: 0 }
    return {
      x: this.buildX - GITHUB_BUILDING_W / 2,
      y: this.buildY - GITHUB_BUILDING_H / 2,
      w: GITHUB_BUILDING_W,
      h: GITHUB_BUILDING_H,
    }
  }

  applyLod(zoomLevel: number): void {
    let lod: number
    if (zoomLevel < LOD_L1_MAX) lod = 1
    else if (zoomLevel < LOD_L2_MAX) lod = 2
    else lod = 3
    if (lod === this.currentLod) return
    this.currentLod = lod

    if (this.outlineRect) this.outlineRect.setVisible(true)
    if (this.outlineLabel) this.outlineLabel.setAlpha(lod === 1 ? 1 : 0)
    if (this.lodL2Container) this.lodL2Container.setVisible(lod >= 2)
    if (this.lodL3Container) this.lodL3Container.setVisible(lod >= 3)
    for (const b of this.columnCountBadges) b.setAlpha(lod === 2 ? 1 : 0)
    if (this.outlineRect) this.outlineRect.setAlpha(lod === 1 ? 0.6 : 0)
  }

  destroy(): void { this.destroyAll() }

  // ── Private ─────────────────────────────────────────────────────────────

  private destroyAll(): void {
    if (this.statusLedTween) { this.statusLedTween.destroy(); this.statusLedTween = null }
    if (this.activityLedPulse) { this.activityLedPulse.destroy(); this.activityLedPulse = null }
    if (this.tabRotateTimer) { this.tabRotateTimer.destroy(); this.tabRotateTimer = null }
    for (const c of this.cardPool) c.container.destroy(true)
    for (const t of this.tabs) t.container.destroy(true)
    this.cardPool = []
    this.tabs = []
    this.columnHeaders = []
    this.columnCountBadges = []
    this.overflowBadges = []
    this.repoList = []
    this.activeRepoIdx = 0
    this.tabPinned = false
    if (this.outlineRect) { this.outlineRect.destroy(); this.outlineRect = null }
    if (this.outlineLabel) { this.outlineLabel.destroy(); this.outlineLabel = null }
    if (this.root) { this.scene.tweens.killTweensOf(this.root); this.root.destroy(true); this.root = null }
    this.statusLed = null
    this.lodL2Container = null
    this.lodL3Container = null
    this.tabContainer = null
    this.lastCards = []
    this.lastCardFingerprint = ''
    this.currentLod = -1
  }

  // ── Tabs ────────────────────────────────────────────────────────────────

  private rebuildTabs(cards: GitHubIssueCard[]): void {
    const repoSet = new Set<string>()
    for (const c of cards) repoSet.add(c.repo)
    const newRepos = Array.from(repoSet).sort()

    if (newRepos.join(',') === this.repoList.join(',')) {
      this.updateTabVisuals(cards)
      return
    }

    this.repoList = newRepos
    if (this.activeRepoIdx >= this.repoList.length + 1) this.activeRepoIdx = 0
    for (const t of this.tabs) t.container.destroy(true)
    this.tabs = []
    if (!this.tabContainer) return

    const inset = WALL_OUTER + WALL_INNER
    const tabBarY = inset + HEADER_H
    let cursorX = inset + 4

    const allRepos = ['__all__', ...this.repoList]
    for (let i = 0; i < allRepos.length; i++) {
      const repo = allRepos[i]
      const name = repo === '__all__' ? 'All' : repoShortName(repo)
      const tab = this.createTab(cursorX, tabBarY + 2, name, repo, i)
      this.tabs.push(tab)
      this.tabContainer.add(tab.container)
      cursorX += tab.label.width + 24
    }
    this.updateTabVisuals(cards)
  }

  private createTab(x: number, y: number, name: string, repo: string, idx: number): TabVisual {
    const scene = this.scene
    const container = scene.add.container(x, y)
    const bg = scene.add.graphics()
    container.add(bg)

    const label = scene.add.text(10, TAB_BAR_H / 2 - 2, name, {
      fontSize: '7px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#94a3b8', resolution: 2,
    }).setOrigin(0, 0.5)
    container.add(label)

    const dot = scene.add.circle(4, TAB_BAR_H / 2 - 2, 2.5, 0x64748b, 0.6)
    container.add(dot)

    const countText = scene.add.text(label.x + label.width + 4, TAB_BAR_H / 2 - 2, '', {
      fontSize: '6px', fontFamily: 'system-ui, sans-serif', color: '#64748b', resolution: 2,
    }).setOrigin(0, 0.5)
    container.add(countText)

    const tabW = label.width + 28
    const hitZone = scene.add.rectangle(tabW / 2, TAB_BAR_H / 2 - 2, tabW, TAB_BAR_H - 2, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    container.add(hitZone)

    hitZone.on('pointerdown', () => {
      this.activeRepoIdx = idx
      this.tabPinned = true
      this.updateTabVisuals(this.lastCards)
      this.updateVisibleBoard(this.lastCards, new Map())
    })

    return { container, bg, label, dot, countText, repo }
  }

  private updateTabVisuals(cards: GitHubIssueCard[]): void {
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i]
      const isActive = i === this.activeRepoIdx
      const isAll = tab.repo === '__all__'
      const repoCards = isAll ? cards : cards.filter(c => c.repo === tab.repo)
      const activeCount = repoCards.filter(c => c.taskStatus === 'active' || c.taskStatus === 'running').length

      tab.bg.clear()
      if (isActive) {
        tab.bg.fillStyle(0x7c3aed, 0.2)
        tab.bg.fillRoundedRect(0, 0, tab.label.width + 28, TAB_BAR_H - 4, 3)
        tab.bg.lineStyle(1, 0x7c3aed, 0.4)
        tab.bg.strokeRoundedRect(0, 0, tab.label.width + 28, TAB_BAR_H - 4, 3)
      }
      tab.label.setColor(isActive ? '#e2e8f0' : '#94a3b8')
      tab.dot.setFillStyle(activeCount > 0 ? 0x22c55e : repoCards.length > 0 ? 0x3b82f6 : 0x64748b, activeCount > 0 ? 0.9 : 0.6)
      tab.countText.setText(repoCards.length > 0 ? `${repoCards.length}` : '').setAlpha(0.6)
    }
  }

  private startTabRotation(): void {
    this.tabRotateTimer = this.scene.time.addEvent({
      delay: TAB_ROTATE_MS, loop: true,
      callback: () => {
        if (this.tabPinned || this.tabs.length <= 2) return
        this.activeRepoIdx = (this.activeRepoIdx + 1) % this.tabs.length
        this.updateTabVisuals(this.lastCards)
        this.updateVisibleBoard(this.lastCards, new Map())
      },
    })
  }

  private getActiveRepo(): string | null {
    if (this.tabs.length === 0) return null
    return this.tabs[this.activeRepoIdx]?.repo ?? null
  }

  // ── Cards ───────────────────────────────────────────────────────────────

  private createCardVisual(): CardVisual {
    const scene = this.scene
    const container = scene.add.container(0, 0)

    const bg = scene.add.graphics()
    bg.fillStyle(0x1e293b, 0.9)
    bg.fillRoundedRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
    bg.lineStyle(1, 0x475569, 0.4)
    bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
    container.add(bg)

    const priorityBar = scene.add.rectangle(2, CARD_RADIUS, 3, CARD_H - 2 * CARD_RADIUS, 0x3b82f6, 0.9).setOrigin(0, 0)
    container.add(priorityBar)

    const numberText = scene.add.text(8, 3, '#0', {
      fontSize: '7px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#e2e8f0', resolution: 2,
    })
    container.add(numberText)

    const titleText = scene.add.text(8, 13, '', {
      fontSize: '6px', fontFamily: 'system-ui, sans-serif', color: '#94a3b8', resolution: 2,
      wordWrap: { width: CARD_W - 18 },
    })
    container.add(titleText)

    const agentDot = scene.add.circle(CARD_W - 8, 8, 3, 0x22c55e, 0).setDepth(1)
    container.add(agentDot)

    const hitZone = scene.add.rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    container.add(hitZone)

    const cv: CardVisual = { container, bg, priorityBar, numberText, titleText, agentDot, cardData: null, columnIdx: -1 }

    hitZone.on('pointerdown', () => {
      if (cv.cardData) {
        EventBus.emit(EVENTS.GITHUB_ISSUE_CLICKED, cv.cardData.url, cv.cardData.issueNumber, cv.cardData.repo)
        window.api.openUrl(cv.cardData.url).catch(() => {})
      }
    })
    hitZone.on('pointerover', () => {
      if (!cv.cardData) return
      numberText.setColor('#ffffff')
      bg.clear()
      bg.fillStyle(0x334155, 0.95)
      bg.fillRoundedRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
      bg.lineStyle(1, 0x7c3aed, 0.6)
      bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
    })
    hitZone.on('pointerout', () => {
      numberText.setColor('#e2e8f0')
      bg.clear()
      bg.fillStyle(0x1e293b, 0.9)
      bg.fillRoundedRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
      bg.lineStyle(1, 0x475569, 0.4)
      bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
    })

    return cv
  }

  private updateVisibleBoard(allCards: GitHubIssueCard[], prevMap: Map<string, GitHubIssueCard>): void {
    if (!this.root) return

    const activeRepo = this.getActiveRepo()
    const cards = (activeRepo && activeRepo !== '__all__')
      ? allCards.filter(c => c.repo === activeRepo) : allCards

    const buckets: GitHubIssueCard[][] = Array.from({ length: COLUMN_COUNT }, () => [])
    for (const card of cards) buckets[cardColumnIndex(card)].push(card)

    for (let i = 0; i < COLUMN_COUNT; i++) {
      if (this.columnCountBadges[i]) {
        this.columnCountBadges[i].setText(`${buckets[i].length}`)
        this.columnCountBadges[i].setColor(buckets[i].length > 0 ? '#e2e8f0' : '#64748b')
      }
    }

    const inset = WALL_OUTER + WALL_INNER
    const colAreaTop = inset + HEADER_H + TAB_BAR_H + COLUMN_HEADER_H + 4
    const colAreaW = GITHUB_BUILDING_W - 2 * inset
    const colW = (colAreaW - (COLUMN_COUNT - 1) * COLUMN_GAP) / COLUMN_COUNT
    const colStartX = inset
    const bottomBarY = GITHUB_BUILDING_H - inset - BOTTOM_BAR_H
    const availH = bottomBarY - colAreaTop - 6
    const maxCardsPerCol = Math.max(1, Math.floor(availH / (CARD_H + CARD_PAD)))

    // Track which taskIds will be placed
    const willPlace = new Set<string>()
    for (let ci = 0; ci < COLUMN_COUNT; ci++) {
      for (let ri = 0; ri < Math.min(buckets[ci].length, maxCardsPerCol); ri++) {
        willPlace.add(buckets[ci][ri].taskId)
      }
    }

    // Only hide cards that won't be re-placed
    for (const cv of this.cardPool) {
      if (cv.cardData && willPlace.has(cv.cardData.taskId)) continue
      cv.container.setAlpha(0)
      cv.cardData = null
      cv.columnIdx = -1
    }
    for (const ob of this.overflowBadges) ob.setAlpha(0)

    let poolIdx = 0
    for (let colIdx = 0; colIdx < COLUMN_COUNT; colIdx++) {
      const bucket = buckets[colIdx]
      const visible = bucket.slice(0, maxCardsPerCol)
      const overflow = bucket.length - visible.length
      const colCenterX = colStartX + colIdx * (colW + COLUMN_GAP) + colW / 2

      for (let ri = 0; ri < visible.length; ri++) {
        if (poolIdx >= this.cardPool.length) break
        const card = visible[ri]
        const cv = this.cardPool[poolIdx++]
        cv.cardData = card
        cv.columnIdx = colIdx

        const targetX = colCenterX - CARD_W / 2
        const targetY = colAreaTop + ri * (CARD_H + CARD_PAD)

        cv.priorityBar.setFillStyle(PRIORITY_COLORS[card.priority] ?? PRIORITY_COLORS.normal, 0.9)
        cv.numberText.setText(`#${card.issueNumber}`)
        const truncTitle = card.title.length > 12 ? card.title.slice(0, 11) + '..' : card.title
        cv.titleText.setText(truncTitle)
        cv.agentDot.setAlpha(card.assignedAgent ? 0.8 : 0)

        cv.container.setPosition(targetX, targetY)
        cv.container.setAlpha(1)
      }

      if (overflow > 0 && this.overflowBadges[colIdx]) {
        this.overflowBadges[colIdx].setText(`+${overflow}`)
        this.overflowBadges[colIdx].setAlpha(1)
      }
    }
  }

  private updateActivityLed(cards: GitHubIssueCard[]): void {
    const hasActivity = cards.some(c => c.taskStatus === 'active' || c.taskStatus === 'running')
    if (!this.statusLed) return
    if (hasActivity) {
      this.statusLed.setFillStyle(0x22c55e, 0.9)
      if (!this.activityLedPulse || !this.activityLedPulse.isPlaying()) {
        this.activityLedPulse = this.scene.tweens.add({
          targets: this.statusLed, alpha: { from: 0.4, to: 1 },
          duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }
    } else {
      if (this.activityLedPulse) { this.activityLedPulse.destroy(); this.activityLedPulse = null }
      this.statusLed.setAlpha(0.6)
      this.statusLed.setFillStyle(cards.length > 0 ? 0x22c55e : 0x64748b, 0.6)
    }
  }

  private startLedPulse(): void {
    if (!this.statusLed) return
    this.statusLedTween = this.scene.tweens.add({
      targets: this.statusLed, alpha: { from: 0.3, to: 0.8 },
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }
}
