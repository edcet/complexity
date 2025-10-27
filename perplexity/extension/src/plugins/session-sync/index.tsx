import { definePlugin } from '@/entrypoints/content/plugins/__core__/definePlugin'
import { SessionSyncPanel } from './panel'
import { sessionStore, initSessionSync } from './store'

export default definePlugin({
  id: 'session-sync',
  name: 'Session Sync',
  description: 'Cross-tab session synchronization with dormant session revival',
  
  async init() {
    // Initialize session sync with sysend.js broadcast
    await initSessionSync()
    
    // Register UI components
    this.registerUI(SessionSyncPanel)
    
    // Hook into state updates
    this.setupStateHooks()
  },
  
  setupStateHooks() {
    // Hook export events
    window.addEventListener('thread:export', (e: any) => {
      sessionStore.updateActivity({
        type: 'export',
        threadId: e.detail?.threadId,
        timestamp: Date.now()
      })
    })
    
    // Hook macro execution
    window.addEventListener('macro:execute', (e: any) => {
      sessionStore.updateActivity({
        type: 'macro',
        macroId: e.detail?.macroId,
        timestamp: Date.now()
      })
    })
    
    // Hook plugin state changes
    window.addEventListener('plugin:statechange', (e: any) => {
      sessionStore.updateActivity({
        type: 'plugin',
        pluginId: e.detail?.pluginId,
        timestamp: Date.now()
      })
    })
  }
})
