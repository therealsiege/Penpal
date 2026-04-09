The code is clear. The fix is minimal — just two changes in `agents.ts`.

**Implementation Plan for #177**

1. **`Penny/src/main/agents.ts` — remove the headless guard on CLAUDE.md injection (line 258)**

   Change:
   ```typescript
   if (!opts.headless) {
     const sharedMemoryPath = path.join(getAgentsDir(), 'CLAUDE.md')
     if (fs.existsSync(sharedMemoryPath)) {
       try {
         const sharedContent = fs.readFileSync(sharedMemoryPath, 'utf-8')
         sharedMemoryNote = `\n\n--- SHARED TEAM KNOWLEDGE ---\n${sharedContent}\n--- END SHARED TEAM KNOWLEDGE ---`
       } catch {
         sharedMemoryNote = ''
       }
     }
   }
   ```
   To (remove the `if (!opts.headless)` wrapper, keep the inner block):
   ```typescript
   const sharedMemoryPath = path.join(getAgentsDir(), 'CLAUDE.md')
   if (fs.existsSync(sharedMemoryPath)) {
     try {
       const sharedContent = fs.readFileSync(sharedMemoryPath, 'utf-8')
       sharedMemoryNote = `\n\n--- SHARED TEAM KNOWLEDGE ---\n${sharedContent}\n--- END SHARED TEAM KNOWLEDGE ---`
       console.log('[agent] injected shared memory:', sharedMemoryNote.length, 'chars')
     } catch {
       sharedMemoryNote = ''
     }
   }
   ```
   Also update the comment above from `// Headless agents get a lean prompt — skip shared memory and verbose persona` to `// All agents receive shared team knowledge (CLAUDE.md)`.

2. **`Penny/src/main/agents.ts` — no change needed to persona or dispatch logic** (lines 270–277 already correctly exclude persona for headless; only the CLAUDE.md guard is the bug).

3. **Verify `agents/CLAUDE.md` exists** — confirm `getAgentsDir()` resolves to `Penny/agents/` and `CLAUDE.md` is present there (no code changes needed).

That's the entire fix — one guard removed, one `console.log` added inside the try block.