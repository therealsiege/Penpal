1. **Update `office-rooms.ts`**  
   - Replace `drawRoomBackground()` procedural floor rendering with tiled hex floor using `LAB_MAIN_TILESET` frames 12-13.  
   - Scale tiles to ~0.25–0.35 to fit ~32–45px effective size.  
   - Tile the entire room floor area in a grid.  
   - Replace procedural wall drawing (`graphics.lineStyle`) with `LAB_MAIN_TILESET` wall/edge frames along room perimeter.  
   - Use `LAB_SMOOTH` corner frames at room corners for smooth transitions.  
   - Ensure sprites added at depth -3 to -2.  
   - Add fallback to procedural rendering if textures not loaded.  
   - Respect LOD system by hiding detail sprites at LOD1.

2. **Update `workspace-unified-floor.ts`**  
   - Replace procedural hex grid with tiled `LAB_MAIN_TILESET` sprites (frames 12-13).  
   - Retain hazard stripe perimeter and cyan glow pools.  
   - Ensure correct depth (-3 to -2).  
   - Respect LOD system.

3. **Update `office-background.ts`**  
   - Orchestrate team area background updates to use new tile-based rendering.  
   - Ensure no changes to workstation rendering.  
   - Maintain existing visual elements (hazard stripes, glow pools).  

4. **Verify Asset Loading**  
   - Confirm `LAB_MAIN_TILESET`, `LAB_SMOOTH`, and `LAB_PROPS` are correctly loaded in `boot-scene.ts`.  
   - Validate sprite frames and grid layouts match expected tileset structure.  

5. **Test LOD Behavior**  
   - Verify detail sprites (walls, floor tiles) are hidden at LOD1.  
   - Ensure fallback rendering works when textures are missing.  

6. **Final Review**  
   - Ensure all rendering matches reference aesthetic: hex floors, dark blue walls, smooth transitions.  
   - Confirm no regression in workstation or UI rendering.  
   - Validate depth and layering behavior in scene.