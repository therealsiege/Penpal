1. Update `Penny/src/renderer/src/panels/CommandCenter.tsx`:
   - Modify `focusAgentFromState` to detect headless agents
   - Add logic to show status card instead of terminal focus for headless agents
   - Import and use new status card component

2. Create new component `Penny/src/renderer/src/panels/HeadlessAgentStatusCard.tsx`:
   - Implement inline status card with stage, plan output, live logs, progress info
   - Include GitHub issue link and agent persona details
   - Add "View Logs" button that opens log viewer

3. Create new component `Penny/src/renderer/src/panels/LogViewer.tsx`:
   - Implement read-only terminal-style log view
   - Display captured stdout/stderr from `runAgentHeadless`
   - Add real-time streaming capability

4. Update `Penny/src/renderer/src/game/OfficeScene.ts`:
   - Modify agent click handler to detect pod agents
   - Trigger new status card display for headless agents

5. Update `Penny/src/renderer/src/game/office-selection.ts`:
   - Add logic to handle headless agent selection state
   - Ensure selection ring works with new status card overlay

6. Update `Penny/src/main/github-pipeline.ts`:
   - Expose pipeline state (stage, plan, error) to renderer
   - Ensure headless agent data is accessible for status card

7. Update `Penny/src/main/sessions.ts`:
   - Ensure `runAgentHeadless` captures and stores stdout/stderr
   - Add API endpoint to fetch logs for a specific agent session