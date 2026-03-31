1. **Identify all hardcoded colors in game files**
   - Run grep command in `src/renderer/src/game/` to find all `0x[0-9a-fA-F]+` and `#[0-9a-fA-F]+` patterns
   - Save results to `color_inventory.txt`

2. **Create color classification spreadsheet**
   - Create `color_classification.xlsx` with columns: File, Line, Color Value, Type (themeable/semantic/constant), Notes
   - Manually classify ~160+ color values from `color_inventory.txt`

3. **Update `OfficeTheme` interface**
   - Modify `src/renderer/src/game/theme/office-theme.ts`
   - Add 60-80 new themeable properties to `OfficeTheme` interface
   - Example: `wallColor: string; floorColor: string; accentColor: string;`

4. **Migrate color values in `office-terrain.ts`**
   - Replace ~149 hardcoded colors with `activeTheme.*` references
   - Update `src/renderer/src/game/office/office-terrain.ts`

5. **Migrate color values in `interactive-props.ts`**
   - Replace ~39 hardcoded colors with `activeTheme.*` references
   - Update `src/renderer/src/game/office/interactive-props.ts`

6. **Migrate color values in `office-rooms.ts`**
   - Replace ~32 hardcoded colors with `activeTheme.*` references
   - Update `src/renderer/src/game/office/office-rooms.ts`

7. **Migrate color values in `office-constants.ts`**
   - Move themeable colors to `OfficeTheme` interface
   - Remove migrated constants from `src/renderer/src/game/office/office-constants.ts`

8. **Migrate color values in `office-interior.ts`**
   - Replace ~30 hardcoded colors with `activeTheme.*` references
   - Update `src/renderer/src/game/office/office-interior.ts`

9. **Migrate color values in `celebrations.ts`**
   - Replace ~27 hardcoded colors with `activeTheme.*` references
   - Update `src/renderer/src/game/office/celebrations.ts`

10. **Migrate color values in `office-corridors.ts`**
    - Replace ~27 hardcoded colors with `activeTheme.*` references
    - Update `src/renderer/src/game/office/office-corridors.ts`

11. **Verify semantic colors remain constant**
    - Document semantic colors (red/green/amber status colors) as intentionally constant
    - Ensure no themeable references in semantic color usage

12. **Test visual regression**
    - Run game with current dark theme
    - Verify no visual regression after migration
    - Confirm all aesthetic colors reference `activeTheme.*` properly