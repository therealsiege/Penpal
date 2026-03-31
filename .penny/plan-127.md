1. **Create new file:** `Penny/src/renderer/src/game/lab-workstation.ts`
   - Implement `LabWorkstationFactory` class that extends or mirrors `WorkstationFactory`
   - Define lab-specific sprites and props using keys from #96
   - Use `desk_top_long.png` or `blank_console_long.png` for desk
   - Use `stool.png` for chair
   - Use `monitor.png` or `free_standing_screen.png` for monitor
   - Use `keyboard.png` or `computer keyboard.png` for keyboard
   - Include lab signature items: `microscope`, `beaker`, `petri_dish`, `tablet`, `clipboard`, `scale`
   - Add `desk_draw.png` as drawer prop

2. **Modify existing workstation creation logic:** 
   - Update `workstation-creation.ts` to support lab variants
   - Add conditional logic to switch between office and lab furniture based on variant type
   - Ensure `WorkstationSprite` type remains consistent

3. **Update PodFoundryScene usage:**
   - Modify `PodFoundryScene` to instantiate lab workstations using `LabWorkstationFactory`
   - Replace office desk sprites with lab desk sprites
   - Replace office chair with stool
   - Replace office monitor with lab monitor

4. **Ensure LOD compatibility:**
   - Verify lab sprites work with existing LOD system (L1/L2/L3 visibility)
   - Test that all lab elements respect LOD settings

5. **Maintain compatibility:**
   - Confirm lab workstations can coexist with office furniture
   - Ensure no breaking changes to existing functionality

6. **Reference asset keys from #96:**
   - Use correct lab prop keys in `lab-workstation.ts`
   - Validate all asset paths are correct and accessible

7. **Testing:**
   - Verify all acceptance criteria are met
   - Test that lab furniture appears correctly in PodFoundry
   - Confirm interface consistency with existing workstation system