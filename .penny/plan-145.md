1. **Update `office-asset-keys.ts`**  
   - Confirm `LAB_PIPES` and `LAB_CABLES` sprite sheet keys are defined and loaded.

2. **Modify `office-corridors.ts`**  
   - Replace current dashed-line corridor rendering logic with tile-based pipe/cable rendering.
   - Use `LAB_PIPES` for corridor floor (straights, T-connectors, crosses).
   - Add hazard stripe edges using yellow/black striped tiles along corridor borders.
   - Place `LAB_CABLES` for secondary wiring along corridors.
   - Scale pipe tiles to ~0.2–0.3 to fit corridor width.
   - Retain `junctionSprites` (cyan glow circles) at junction points.
   - Ensure particle animations still render over pipe corridors.
   - Maintain LOD compatibility.

3. **Update corridor geometry handling**  
   - Ensure pipe/cable tile placement aligns with existing corridor path data.
   - Validate that all corridor connections (T-junctions, crosses) are correctly placed.

4. **Test rendering at all LOD levels**  
   - Verify that pipe/cable tiles render correctly across different detail levels.
   - Confirm no performance regression.

5. **Validate particle animation overlay**  
   - Ensure data-flow particle effects render correctly on top of new pipe/cable corridors.