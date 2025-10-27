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
