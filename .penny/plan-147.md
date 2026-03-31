1. **Update `Penny/src/main/github-pipeline.ts`**  
   Add validation stage logic after executor:
   ```typescript
   if (tracked.stage === 'validating' && !tracked.validatorRunning) {
     const result = await runValidatorAgent(config, tracked);
     // Upload screenshots from worktree to PR comment
     // Advance to 'done' or 'failed'
   }
   ```

2. **Update `Penny/agents/agent-types.yaml`**  
   Add new `issue-validator` agent:
   ```yaml
   issue-validator:
     model: sonnet # or ollama for cost savings
     mcpProfile: qa-executor
     systemPrompt: "Run tests, capture screenshots, report results"
     allowedTools:
       - bash
       - read
       - playwright-mcp
   ```

3. **Ensure `Penny/agents/mcp-profiles/qa-executor.json` exists**  
   Confirm it includes Playwright MCP tools for screenshot capture.

4. **Implement `runValidatorAgent` function in `github-pipeline.ts`**  
   - Run `npm test` (vitest)
   - Start dev server with `npm run dev`
   - Use Playwright to navigate app, capture screenshots at LOD1/2/3 and UI areas
   - Save screenshots to `.playwright-screenshots/` in worktree
   - Upload images to PR comment using `gh api` or branch reference

5. **Update `.env` if needed**  
   Ensure `PENNY_TASK_RUNNER_VALIDATING=ollama,claude` is set for validator agent chain.

6. **Add screenshot upload logic to PR comment**  
   - Base64 encode screenshots
   - Post as markdown image embeds in PR comment via `gh api`

🤖 Generated with [Claude Code](https://claude.com/claude-code)