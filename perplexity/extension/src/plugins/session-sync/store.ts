import { proxy } from 'valtio'
import * as sysend from 'sysend'
import { SessionState, SessionActivity, SessionSnapshot } from './types'

const DB_NAME = 'complexity-session-sync'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const SYNC_CHANNEL = 'session-sync'

interface IDBSession {
  id: string
  deviceId: string
  tabId: string
  lastActive: number
  snapshot: SessionSnapshot
  activities: SessionActivity[]
  isDormant: boolean
}

class SessionStore {
  private db: IDBDatabase | null = null
  private currentSession: IDBSession
  private heartbeatInterval: number | null = null
  
  state = proxy<SessionState>({
    currentSessionId: '',
    deviceId: '',
    tabId: '',
    sessions: [],
    dormantSessions: [],
    historicalSessions: []
  })
  
  constructor() {
    this.currentSession = this.createSession()
    this.state.currentSessionId = this.currentSession.id
    this.state.deviceId = this.currentSession.deviceId
    this.state.tabId = this.currentSession.tabId
  }
  
  private createSession(): IDBSession {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deviceId: this.getOrCreateDeviceId(),
      tabId: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      lastActive: Date.now(),
      snapshot: this.captureSnapshot(),
      activities: [],
      isDormant: false
    }
  }
  
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('complexity-device-id')
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('complexity-device-id', deviceId)
    }
    return deviceId
  }
  
  private captureSnapshot(): SessionSnapshot {
    return {
      url: window.location.href,
      timestamp: Date.now(),
      scrollPosition: window.scrollY,
      pluginStates: this.capturePluginStates(),
      macroStates: this.captureMacroStates(),
      threadState: this.captureThreadState()
    }
  }
  
  private capturePluginStates(): Record<string, any> {
    // Capture plugin states from localStorage or window state
    const states: Record<string, any> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('plugin:')) {
        try {
          states[key] = JSON.parse(localStorage.getItem(key) || '{}')
        } catch (e) {
          states[key] = localStorage.getItem(key)
        }
      }
    }
    return states
  }
  
  private captureMacroStates(): Record<string, any> {
    const states: Record<string, any> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('macro:')) {
        try {
          states[key] = JSON.parse(localStorage.getItem(key) || '{}')
        } catch (e) {
          states[key] = localStorage.getItem(key)
        }
      }
    }
    return states
  }
  
  private captureThreadState(): any {
    // Capture current thread state from DOM or app state
    const threadId = window.location.pathname.match(/\/chat\/([^/]+)/)?.[1]
    return {
      threadId,
      messages: [] // Would need to extract from app state
    }
  }
  
  async init() {
    await this.initIndexedDB()
    await this.loadSessions()
    this.setupSysendBroadcast()
    this.startHeartbeat()
    this.setupBeforeUnload()
  }
  
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('lastActive', 'lastActive', { unique: false })
          store.createIndex('deviceId', 'deviceId', { unique: false })
          store.createIndex('isDormant', 'isDormant', { unique: false })
        }
      }
    })
  }
  
  private async loadSessions() {
    if (!this.db) return
    
    const transaction = this.db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    
    request.onsuccess = () => {
      const sessions = request.result as IDBSession[]
      
      // Sort by last active (least recently used first)
      sessions.sort((a, b) => a.lastActive - b.lastActive)
      
      const now = Date.now()
      const DORMANT_THRESHOLD = 5 * 60 * 1000 // 5 minutes
      const HISTORICAL_THRESHOLD = 24 * 60 * 60 * 1000 // 24 hours
      
      this.state.sessions = sessions.filter(s => 
        now - s.lastActive < DORMANT_THRESHOLD && !s.isDormant
      )
      
      this.state.dormantSessions = sessions.filter(s => 
        now - s.lastActive >= DORMANT_THRESHOLD && 
        now - s.lastActive < HISTORICAL_THRESHOLD
      )
      
      this.state.historicalSessions = sessions.filter(s => 
        now - s.lastActive >= HISTORICAL_THRESHOLD
      )
    }
  }
  
  private setupSysendBroadcast() {
    // Listen for broadcasts from other tabs
    sysend.on(SYNC_CHANNEL, (data: any) => {
      if (data.type === 'heartbeat' && data.sessionId !== this.currentSession.id) {
        this.updateRemoteSession(data)
      }
      if (data.type === 'activity' && data.sessionId !== this.currentSession.id) {
        this.handleRemoteActivity(data)
      }
      if (data.type === 'revive-request') {
        this.handleReviveRequest(data)
      }
    })
    
    // Save current session to IndexedDB
    this.saveSession(this.currentSession)
  }
  
  private updateRemoteSession(data: any) {
    // Update session list with remote session data
    const existingIndex = this.state.sessions.findIndex(s => s.id === data.sessionId)
    if (existingIndex >= 0) {
      this.state.sessions[existingIndex] = {
        ...this.state.sessions[existingIndex],
        lastActive: data.timestamp
      }
    }
  }
  
  private handleRemoteActivity(data: any) {
    // Update activities from remote tabs
    const session = this.state.sessions.find(s => s.id === data.sessionId)
    if (session) {
      session.activities = session.activities || []
      session.activities.push(data.activity)
    }
  }
  
  private async handleReviveRequest(data: any) {
    if (data.sessionId === this.currentSession.id) {
      // Send current session snapshot to requester
      sysend.broadcast(SYNC_CHANNEL, {
        type: 'revive-response',
        sessionId: this.currentSession.id,
        snapshot: this.captureSnapshot(),
        targetTabId: data.requesterId
      })
    }
  }
  
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      this.currentSession.lastActive = Date.now()
      this.currentSession.snapshot = this.captureSnapshot()
      
      // Broadcast heartbeat to other tabs
      sysend.broadcast(SYNC_CHANNEL, {
        type: 'heartbeat',
        sessionId: this.currentSession.id,
        deviceId: this.currentSession.deviceId,
        tabId: this.currentSession.tabId,
        timestamp: Date.now()
      })
      
      // Save to IndexedDB
      this.saveSession(this.currentSession)
      
      // Reload sessions to update dormant/historical status
      this.loadSessions()
    }, 10000) // Every 10 seconds
  }
  
  private setupBeforeUnload() {
    window.addEventListener('beforeunload', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
      }
      // Mark session as potentially dormant
      this.currentSession.lastActive = Date.now()
      this.saveSession(this.currentSession)
    })
  }
  
  private async saveSession(session: IDBSession) {
    if (!this.db) return
    
    const transaction = this.db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.put(session)
  }
  
  async updateActivity(activity: SessionActivity) {
    this.currentSession.activities.push(activity)
    this.currentSession.lastActive = Date.now()
    
    // Broadcast activity to other tabs
    sysend.broadcast(SYNC_CHANNEL, {
      type: 'activity',
      sessionId: this.currentSession.id,
      activity,
      timestamp: Date.now()
    })
    
    await this.saveSession(this.currentSession)
  }
  
  async reviveSession(sessionId: string) {
    // Load session from IndexedDB
    if (!this.db) return null
    
    const transaction = this.db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(sessionId)
    
    return new Promise<SessionSnapshot | null>((resolve) => {
      request.onsuccess = () => {
        const session = request.result as IDBSession
        if (session) {
          // Request live snapshot from the session's tab if still active
          const responseHandler = (data: any) => {
            if (data.type === 'revive-response' && 
                data.sessionId === sessionId && 
                data.targetTabId === this.currentSession.tabId) {
              sysend.off(SYNC_CHANNEL, responseHandler)
              resolve(data.snapshot)
            }
          }
          
          sysend.on(SYNC_CHANNEL, responseHandler)
          
          sysend.broadcast(SYNC_CHANNEL, {
            type: 'revive-request',
            sessionId,
            requesterId: this.currentSession.tabId
          })
          
          // Fallback to stored snapshot after 1 second
          setTimeout(() => {
            sysend.off(SYNC_CHANNEL, responseHandler)
            resolve(session.snapshot)
          }, 1000)
        } else {
          resolve(null)
        }
      }
      
      request.onerror = () => resolve(null)
    })
  }
  
  async restoreSnapshot(snapshot: SessionSnapshot) {
    // Restore plugin states
    Object.entries(snapshot.pluginStates).forEach(([key, value]) => {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    })
    
    // Restore macro states
    Object.entries(snapshot.macroStates).forEach(([key, value]) => {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    })
    
    // Navigate to the URL
    if (snapshot.url !== window.location.href) {
      window.location.href = snapshot.url
    } else {
      // Just scroll if same page
      window.scrollTo(0, snapshot.scrollPosition)
    }
    
    // Reload the page to apply states
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }
  
  async markSessionHistorical(sessionId: string) {
    if (!this.db) return
    
    const transaction = this.db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(sessionId)
    
    request.onsuccess = () => {
      const session = request.result as IDBSession
      if (session) {
        session.isDormant = true
        store.put(session)
        this.loadSessions()
      }
    }
  }
  
  async deleteSession(sessionId: string) {
    if (!this.db) return
    
    const transaction = this.db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.delete(sessionId)
    await this.loadSessions()
  }
}

export const sessionStore = new SessionStore()

export async function initSessionSync() {
  await sessionStore.init()
}
