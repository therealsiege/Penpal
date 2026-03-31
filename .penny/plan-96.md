1. **Create build scripts in `Penny/scripts/`:**
   - `build-lab-props.mjs`
   - `build-lab-pipes.mjs`
   - `build-lab-cables.mjs`
   - `build-lab-floor.mjs`
   - `build-lab-panels.mjs`

2. **Modify `Penny/scripts/build-all-sprites.mjs`:**
   - Add the 5 new build scripts to the `SCRIPTS` array.

3. **Modify `Penny/src/renderer/src/game/office-asset-keys.ts`:**
   - Add `LAB_PROPS`, `LAB_PIPES`, `LAB_CABLES`, `LAB_FLOOR`, `LAB_PANELS` to `SPRITESHEET_KEYS`.
   - Add `LAB_PROP_FRAMES` with the specified named indices.
   - Add `LAB_PIPE_FRAMES` with the specified named indices.
   - Add `LAB_CABLE_FRAMES`, `LAB_FLOOR_FRAMES`, `LAB_PANEL_FRAMES` with appropriate named indices.
   - Add `LAB_ANIM_KEYS` with `CONSOLE_WAVE`, `CONSOLE_LINES`, `LASER_EFFECT` and their frame sequences.

4. **Modify `Penny/src/renderer/src/game/boot-scene.ts`:**
   - Load the 5 new spritesheets in the preloader.

5. **Ensure output directory:**
   - All generated spritesheets are written to `Penny/public/sprites/`.

6. **Verify build script pattern:**
   - All scripts follow the `sharp` composite pattern from `build-office-furniture.mjs`.
   - Source directory: `../../Phaser.Resources/lab/` (relative to Penny root).
   - PNGs are sorted alphabetically, resized to target cell size, composited into grids with transparent background, and written to output directory.