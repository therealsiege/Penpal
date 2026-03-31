1. **Create `Penny/src/renderer/src/game/cable-renderer.ts`**
   - Implement `CableRenderer` class with methods for:
     - `renderCable(start, end, channel)` to generate and place cable tiles
     - `getPathPoints(start, end)` for Manhattan pathfinding
     - `selectTileType(prev, curr, next)` to determine correct tile piece
     - `placePlugConnector(position, isStart)` for endpoint sprites
     - `placeLooseCable(position)` for decorative floor clutter
     - `tintCable(color)` for channel-specific coloring
     - `animatePowerOn()` for sequential alpha reveal
     - `showDisconnected()` for cut end tiles

2. **Update `LAB_CABLE_FRAMES` in `Penny/src/renderer/src/game/cable-renderer.ts`**
   - Import and reference `LAB_CABLE_FRAMES` from #96
   - Use tileset frames for rendering all cable segments, corners, bumps, loops, and cut ends

3. **Add Cable Channel Color Definitions**
   - Define color constants for channels:
     - `SOLVER_BLUE = '#007BFF'`
     - `REVIEWER_GREEN = '#28A745'`
     - `EXECUTOR_ORANGE = '#FD7E14'`

4. **Implement Auto-Routing Logic**
   - In `getPathPoints(start, end)`:
     - Calculate Manhattan path using horizontal/vertical segments
     - Store intermediate points for tile placement and direction changes

5. **Add Tile Selection Logic**
   - In `selectTileType(prev, curr, next)`:
     - Determine tile type based on direction changes
     - Select appropriate straight, corner, bump, loop, or cut tile from `LAB_CABLE_FRAMES`

6. **Implement Power-On Animation**
   - Add `animatePowerOn()` method:
     - Sequentially set alpha from 0 to 1 along cable path
     - Use delay between segments for visual effect

7. **Add Disconnected State Handling**
   - Implement `showDisconnected()`:
     - Replace end tiles with cut end variants from `LAB_CABLE_FRAMES`
     - Optionally animate transition

8. **Integrate with PodFoundry Scene**
   - In `PodFoundryScene` or relevant loader:
     - Instantiate `CableRenderer`
     - Call `renderCable()` for hub-to-pod connections
     - Use `placeLooseCable()` for decorative cabling

9. **Support Campus Scene Usage**
   - Ensure `CableRenderer` is reusable:
     - Accept configurable start/end points
     - Support multiple channel types
     - Allow for scene-specific placement logic

10. **Performance Optimization**
   - Ensure cables are static sprites:
     - Only recreate when layout changes
     - Avoid dynamic updates unless needed
     - Cache tile references for performance

11. **Testing & Validation**
   - Test auto-routing with various start/end positions
   - Validate tile selection logic for all direction changes
   - Confirm power-on animation and disconnected state work
   - Verify color tinting and plug connector placement
   - Confirm loose cable placement works as decorative clutter