export interface SessionActivity {
  type: 'export' | 'macro' | 'plugin' | 'navigation' | 'search'
  timestamp: number
  threadId?: string
  macroId?: string
  pluginId?: string
  url?: string
  query?: string
}

export interface SessionSnapshot {
  url: string
  timestamp: number
  scrollPosition: number
  pluginStates: Record<string, any>
  macroStates: Record<string, any>
  threadState: ThreadState
}

export interface ThreadState {
  threadId?: string
  messages: any[]
}

export interface Session {
  id: string
  deviceId: string
  tabId: string
  lastActive: number
  snapshot: SessionSnapshot
  activities: SessionActivity[]
  isDormant: boolean
}

export interface SessionState {
  currentSessionId: string
  deviceId: string
  tabId: string
  sessions: Session[]
  dormantSessions: Session[]
  historicalSessions: Session[]
}

export interface SysendMessage {
  type: 'heartbeat' | 'activity' | 'revive-request' | 'revive-response'
  sessionId: string
  deviceId?: string
  tabId?: string
  timestamp?: number
  activity?: SessionActivity
  snapshot?: SessionSnapshot
  requesterId?: string
  targetTabId?: string
}

// New enhancement: Session validation and error tracking
export interface SessionError {
  code: 'SYNC_FAILED' | 'SNAPSHOT_CORRUPT' | 'STORAGE_QUOTA' | 'NETWORK_ERROR' | 'VALIDATION_ERROR'
  message: string
  timestamp: number
  sessionId?: string
  context?: Record<string, any>
}

export interface SessionMetrics {
  totalSessions: number
  activeSessions: number
  dormantSessions: number
  historicalSessions: number
  syncLatency: number
  lastSyncTime: number
  errors: SessionError[]
}
