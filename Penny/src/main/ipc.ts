import { ipcMain } from 'electron'
import { 
  listMcpServers, 
  addMcpServer, 
  updateMcpServer, 
  deleteMcpServer, 
  toggleMcpServer, 
  syncToTargets,
  discoverAndImportMcpConfigs,
  TEMPLATE_SERVERS
} from './mcp-manager'

export function registerMcpIpcHandlers() {
  ipcMain.handle('mcp:list', async () => {
    try {
      const servers = listMcpServers()
      return { success: true, data: servers }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:add', async (_event, serverData) => {
    try {
      const server = addMcpServer(serverData)
      syncToTargets()
      return { success: true, data: server }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:update', async (_event, id, updates) => {
    try {
      const server = updateMcpServer(id, updates)
      syncToTargets()
      return { success: true, data: server }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:delete', async (_event, id) => {
    try {
      const success = deleteMcpServer(id)
      if (success) {
        syncToTargets()
      }
      return { success: true, deleted: success }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:toggle', async (_event, id, enabled) => {
    try {
      const success = toggleMcpServer(id, enabled)
      if (success) {
        syncToTargets()
      }
      return { success: true, toggled: success }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:import', async () => {
    try {
      const result = await discoverAndImportMcpConfigs()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:templates', async () => {
    try {
      return { success: true, data: TEMPLATE_SERVERS }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('mcp:sync', async () => {
    try {
      syncToTargets()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}