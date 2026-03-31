1. **Update `workstation-creation.ts`**  
   - Replace `chairSprite` creation with `LAB_PROP_FRAMES.STOOL` at 0.22 scale, positioned at `(0, WS_CHAIR_Y+4)`  
   - Replace `deskBody` and `deskTop` styling:  
     - `deskBody`: fill color `0x1a3a52`, stroke `0x22d3ee` with `0.4` alpha, same dimensions (80×21px)  
     - `deskTop`: keep same 77×3px, accent color  
   - Replace `monitorSprite` with `LAB_PROP_FRAMES.CONSOLE_SCREEN` at 0.22 scale, positioned at `(0, WS_MONITOR_Y)`  
   - Ensure glow FX and screen line animations remain intact  
   - Add fallback logic: if `LAB_PROP_FRAMES` not loaded, default to office sprites (`FRAME_CHAIR_DARK`, `FRAME_MONITOR`)  

2. **Verify `lab-prop-frames.generated.ts`**  
   - Confirm `LAB_PROP_FRAMES.STOOL` and `LAB_PROP_FRAMES.CONSOLE_SCREEN` are defined  
   - Ensure texture loading logic handles missing frames gracefully  

3. **Test LOD behavior**  
   - Confirm `lodLevel2Objects` and `lodLevel3Objects` still function correctly with new sprites  
   - Validate no visual artifacts or layout shifts at different LOD levels  

4. **Validate workstation footprint**  
   - Confirm total workstation size remains 80×60px  
   - Ensure no layout changes to character, name, status dot, XP bar, etc.  

5. **Run unit/integration tests**  
   - Ensure no regression in workstation rendering or interaction logic  
   - Confirm console screen animations and FX still work as expected  

6. **Document changes**  
   - Add brief note in `workstation-creation.ts` for future maintainers on lab reskin logic  
   - Update any relevant inline comments to reflect new lab-style elements