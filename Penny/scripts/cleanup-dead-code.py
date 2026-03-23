#!/usr/bin/env python3
"""Remove dead code ranges from OfficeScene.ts"""

import sys

filepath = 'src/renderer/src/game/OfficeScene.ts'

with open(filepath) as f:
    lines = f.readlines()

original_count = len(lines)
print(f"Original: {original_count} lines")

def find_line(needle, start=1, lines=lines):
    """Find the 1-indexed line number containing needle"""
    for i in range(start-1, len(lines)):
        if needle in lines[i]:
            return i+1
    return None

def find_method_end(start_1indexed, lines=lines):
    """Find the closing } of a method starting at start_1indexed (1-indexed)"""
    depth = 0
    for i in range(start_1indexed-1, len(lines)):
        line = lines[i]
        for ch in line:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return i+1
    return None

# Collect removal ranges as (start, end) 1-indexed inclusive
removals = []

# 1. Big layout/background dead block:
# From comment before _oldLayoutRooms2_DEAD through updateWhiteboardStats close
l_start = find_line('drawTeamAreas, drawCorridors, drawHallwayIndicators')
l_uws = find_line('private updateWhiteboardStats(): void {')
if l_start and l_uws:
    l_end = find_method_end(l_uws)
    print(f"Big layout/bg block: L{l_start-1}-{l_end}")
    removals.append((l_start-1, l_end))

# 2. _neverCalledURA block
l = find_line('_neverCalledURA')
if l:
    l_end = find_method_end(l)
    # Include the comment line before it
    l_start = l - 2  # "// [updateRoomActivity..." comment
    print(f"_neverCalledURA: L{l_start}-{l_end}")
    removals.append((l_start, l_end))

# 3. Dead body in showToast (from line after `return` to before closing `}`)
l = find_line('this.ui.showToast(text, type); return')
if l:
    l_end_method = find_method_end(l - 1)
    if l_end_method:
        # Remove from l+1 to l_end_method-1
        print(f"showToast dead body: L{l+1}-{l_end_method-1}")
        removals.append((l+1, l_end_method-1))

# 4. reflowToasts + _reflowToasts_DELETED
l = find_line("private reflowToasts(): void { /* dead")
if l:
    # eslint-disable-next-line line before
    l_start = l - 1
    l_rrd = find_line('_reflowToasts_DELETED')
    if l_rrd:
        l_end = find_method_end(l_rrd)
        print(f"reflowToasts + _reflowToasts_DELETED: L{l_start}-{l_end}")
        removals.append((l_start, l_end))

# 5. initMinimap through panCameraFromMinimapPointer (all dead minimap helpers in OfficeScene)
l = find_line('private initMinimap(): void {')
if l:
    l_pcm = find_line('private panCameraFromMinimapPointer(pointer', l)
    if l_pcm:
        l_end = find_method_end(l_pcm)
        print(f"initMinimap + minimap helpers: L{l}-{l_end}")
        removals.append((l, l_end))

# 6. buildStatusBar through getStatusBarTime
l = find_line('private buildStatusBar(): void {')
if l:
    l_gst = find_line('private getStatusBarTime(): string {', l)
    if l_gst:
        l_end = find_method_end(l_gst)
        print(f"statusBar methods: L{l}-{l_end}")
        removals.append((l, l_end))

# 7. drawMinimap
l = find_line('private drawMinimap(): void {')
if l:
    l_end = find_method_end(l)
    print(f"drawMinimap: L{l}-{l_end}")
    removals.append((l, l_end))

# 8. applyLod
l = find_line('private applyLod(level: number): void {')
if l:
    l_end = find_method_end(l)
    print(f"applyLod: L{l}-{l_end}")
    removals.append((l, l_end))

# 9. showLodLabel
l = find_line('private showLodLabel(level: number): void {')
if l:
    l_end = find_method_end(l)
    print(f"showLodLabel: L{l}-{l_end}")
    removals.append((l, l_end))

# 10. Dead keyboard stubs section header + single-line stubs
# Find the header comment
l_header = find_line('Keyboard navigation helpers — extracted to office-selection.ts')
if l_header:
    # The section has stubs + drawSelectionRing dead body + clearSelectionRing + pan/zoom/auto-pan
    # Find end of stopAutoPan
    l_spa = find_line('private stopAutoPan(): void {')
    if l_spa:
        l_end = find_method_end(l_spa)
        # Also include the kbd section header above (3 lines above stub section)
        print(f"Keyboard nav helpers section: L{l_header-1}-{l_end}")
        removals.append((l_header-1, l_end))

# 11. Dead body in showHelpOverlay (after `return`)
l = find_line('this.ui.showHelpOverlay(); return')
if l:
    l_end_method = find_method_end(l - 1)
    if l_end_method:
        print(f"showHelpOverlay dead body: L{l+1}-{l_end_method-1}")
        removals.append((l+1, l_end_method-1))

# 12. Dead body in hideHelpOverlay (after `return`)
l = find_line('this.ui.hideHelpOverlay(); return')
if l:
    l_end_method = find_method_end(l - 1)
    if l_end_method:
        print(f"hideHelpOverlay dead body: L{l+1}-{l_end_method-1}")
        removals.append((l+1, l_end_method-1))

# 13. showDebugOverlay, hideDebugOverlay (these delegate then return but are dead callers)
# showDebugOverlay
l = find_line('private showDebugOverlay(): void {')
if l:
    l_end = find_method_end(l)
    print(f"showDebugOverlay: L{l}-{l_end}")
    removals.append((l, l_end))

# hideDebugOverlay
l = find_line('private hideDebugOverlay(): void {')
if l:
    l_end = find_method_end(l)
    print(f"hideDebugOverlay: L{l}-{l_end}")
    removals.append((l, l_end))

# 14. refreshDebugOverlay, drawNavMeshDebug, dumpSceneGraph
for name in ['private refreshDebugOverlay(_time', 'private drawNavMeshDebug', 'private dumpSceneGraph']:
    l = find_line(name)
    if l:
        l_end = find_method_end(l)
        print(f"{name}: L{l}-{l_end}")
        removals.append((l, l_end))

# 15. _tickAmbientActivity_MOVED and all ambient methods
l = find_line('_tickAmbientActivity_MOVED')
if l:
    l_ada = find_line('private ambientDoorPeek(allRooms: Room[]): void {', l)
    if l_ada:
        l_end = find_method_end(l_ada)
        # Go back 2 lines for comment before _tickAmbient
        print(f"ambient methods: L{l-2}-{l_end}")
        removals.append((l-2, l_end))

# Sort removals and check for overlaps
removals.sort(key=lambda x: x[0])
print(f"\n{len(removals)} removal ranges found")
for r in removals:
    print(f"  L{r[0]}-{r[1]}: {r[1]-r[0]+1} lines")

# Validate: no overlaps
valid = True
for i in range(1, len(removals)):
    if removals[i][0] <= removals[i-1][1]:
        print(f"ERROR: overlap between L{removals[i-1]} and L{removals[i]}")
        valid = False

if not valid:
    print("Aborting due to overlaps")
    sys.exit(1)

# Apply removals in reverse order
# Convert to set of 0-indexed line numbers to remove
to_remove = set()
for (s, e) in removals:
    for i in range(s-1, e):  # 0-indexed
        to_remove.add(i)

new_lines = [line for i, line in enumerate(lines) if i not in to_remove]
with open(filepath, 'w') as f:
    f.writelines(new_lines)

print(f"\nDone: {original_count} -> {len(new_lines)} lines (removed {original_count - len(new_lines)} lines)")
