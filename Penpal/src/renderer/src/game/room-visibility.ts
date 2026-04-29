// ---------------------------------------------------------------------------
// RoomVisibilityManager — enable/disable room objects based on camera viewport
//
// Objects outside the visible area are set inactive+invisible (and their
// physics bodies disabled) rather than destroyed, so re-entry is cheap.
// A padding buffer activates rooms slightly before they scroll into view to
// avoid pop-in artifacts.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ManagedRoom {
  id: string
  bounds: RoomBounds
  objects: Phaser.GameObjects.GameObject[]
}

// ---------------------------------------------------------------------------
// RoomVisibilityManager
// ---------------------------------------------------------------------------

/** Viewport padding in world-space pixels. Rooms within this margin outside
 *  the camera view are pre-activated so there is no visible pop-in on scroll. */
const ACTIVATION_PADDING = 200

export class RoomVisibilityManager {
  private _rooms = new Map<string, ManagedRoom>()
  private _activeRoomIds = new Set<string>()

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /** Add a room to the visibility system. Safe to call multiple times — a
   *  second registration for the same id replaces the previous entry. */
  registerRoom(room: ManagedRoom): void {
    this._rooms.set(room.id, room)
  }

  /** Associate a game object with a room so the manager controls its
   *  active/visible state. The object is appended to the room's list;
   *  duplicates are not checked (caller responsibility). */
  addObjectToRoom(roomId: string, object: Phaser.GameObjects.GameObject): void {
    const room = this._rooms.get(roomId)
    if (room) {
      room.objects.push(object)
    }
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /** Call once per frame (or on a throttled tick) with the active camera.
   *  Computes which rooms intersect the padded viewport and enables/disables
   *  them as the set changes. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const vx = camera.scrollX - ACTIVATION_PADDING
    const vy = camera.scrollY - ACTIVATION_PADDING
    const vw = camera.width / camera.zoom + ACTIVATION_PADDING * 2
    const vh = camera.height / camera.zoom + ACTIVATION_PADDING * 2

    for (const [id, room] of this._rooms) {
      const { x, y, width, height } = room.bounds
      const intersects =
        x < vx + vw &&
        x + width > vx &&
        y < vy + vh &&
        y + height > vy

      const wasActive = this._activeRoomIds.has(id)

      if (intersects && !wasActive) {
        this._enableRoom(id, room)
      } else if (!intersects && wasActive) {
        this._disableRoom(id, room)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Enable / disable
  // ---------------------------------------------------------------------------

  /** Enable all objects for a room and emit ROOM_ENTERED. */
  private _enableRoom(id: string, room: ManagedRoom): void {
    for (const obj of room.objects) {
      if (!obj.active) {
        obj.setActive(true)
        ;(obj as unknown as { setVisible(v: boolean): void }).setVisible(true)
        const body = (obj as Phaser.Types.Physics.Arcade.GameObjectWithBody).body
        if (body) {
          (body as Phaser.Physics.Arcade.Body).enable = true
        }
      }
    }
    this._activeRoomIds.add(id)
    EventBus.emit(EVENTS.ROOM_ENTERED, id)
  }

  /** Disable all objects for a room and emit ROOM_EXITED. */
  private _disableRoom(id: string, room: ManagedRoom): void {
    for (const obj of room.objects) {
      if (obj.active) {
        obj.setActive(false)
        ;(obj as unknown as { setVisible(v: boolean): void }).setVisible(false)
        const body = (obj as Phaser.Types.Physics.Arcade.GameObjectWithBody).body
        if (body) {
          (body as Phaser.Physics.Arcade.Body).enable = false
        }
      }
    }
    this._activeRoomIds.delete(id)
    EventBus.emit(EVENTS.ROOM_EXITED, id)
  }

  // ---------------------------------------------------------------------------
  // Public accessors (force-enable / force-disable for external callers)
  // ---------------------------------------------------------------------------

  /** Force-enable a room regardless of camera position. */
  enableRoom(id: string): void {
    const room = this._rooms.get(id)
    if (room && !this._activeRoomIds.has(id)) {
      this._enableRoom(id, room)
    }
  }

  /** Force-disable a room regardless of camera position. */
  disableRoom(id: string): void {
    const room = this._rooms.get(id)
    if (room && this._activeRoomIds.has(id)) {
      this._disableRoom(id, room)
    }
  }

  /** Returns true if the room is currently enabled. */
  isRoomActive(id: string): boolean {
    return this._activeRoomIds.has(id)
  }

  /** Returns a snapshot of the currently-active room IDs. */
  getActiveRooms(): ReadonlySet<string> {
    return this._activeRoomIds
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Remove a room from management without touching its objects. */
  unregisterRoom(id: string): void {
    this._rooms.delete(id)
    this._activeRoomIds.delete(id)
  }

  /** Clear all state. Does not enable/disable any objects. */
  destroy(): void {
    this._rooms.clear()
    this._activeRoomIds.clear()
  }
}
