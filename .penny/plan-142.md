1. **Update `lab-facility-decor.ts`**  
   - Import `detectRoomType` from `office-layout.ts`.
   - Modify `placeDecor` function to accept `room` object and extract workstation positions.
   - Create exclusion rectangles (90×70px) around each workstation to prevent prop overlap.

2. **Add wall mounting logic**  
   - In `placeDecor`, identify wall sides (top, bottom, left, right) of the room.
   - Place consoles, shelves, and warning signs only along these wall edges, not in center.

3. **Add centerpiece placement logic**  
   - Determine center gap between workstation rows in each room.
   - Place one large centerpiece (e.g., generator, tank, dome) in the gap.
   - Use `detectRoomType()` to select appropriate centerpiece per room type.

4. **Implement scale and alpha rules**  
   - Apply scale 0.18–0.22 for wall props, 0.28–0.32 for centerpieces.
   - Set alpha to 0.6–0.75 for background decor, 0.85–0.95 for centerpieces.

5. **Limit decor count per room**  
   - Add a counter to ensure max 15–20 props per room.
   - Prioritize placement: workstations → wall props → centerpieces → background decor.

6. **Use room-type-specific props**  
   - Map room types (from `detectRoomType`) to prop sets:
     - Control room → consoles, LED screens, keyboards, desks
     - Chemical station → beakers, microscopes, sinks, test tubes
     - Machinery bay → generators, tanks, fans, power cells
     - Pod bay → pods, sliding doors, warning signs

7. **Refactor prop placement logic**  
   - Group prop placement by type and zone.
   - Use `SPRITESHEET_KEYS.LAB_PROPS` and `lab-prop-frames.generated.ts` to fetch correct sprite indices.

8. **Test and validate**  
   - Run tests to confirm exclusion rectangles work.
   - Verify correct props appear in correct zones.
   - Validate scale and alpha values visually in-game.

🤖 **File Paths:**  
- `Penny/src/renderer/src/game/lab-facility-decor.ts`  
- `Penny/src/renderer/src/game/office-layout.ts`  
- `Penny/src/renderer/src/game/lab-prop-frames.generated.ts`