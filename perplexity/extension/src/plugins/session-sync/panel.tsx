import { useSnapshot } from 'valtio'
import { sessionStore } from './store'
import { Session } from './types'
import { useState } from 'react'

export function SessionSyncPanel() {
  const state = useSnapshot(sessionStore.state)
  const [isOpen, setIsOpen] = useState(false)
  const [reviving, setReviving] = useState<string | null>(null)

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getSessionTitle = (session: Session) => {
    const url = new URL(session.snapshot.url)
    return url.pathname.split('/').filter(Boolean).pop() || 'Unknown'
  }

  const handleRevive = async (sessionId: string) => {
    setReviving(sessionId)
    try {
      const snapshot = await sessionStore.reviveSession(sessionId)
      if (snapshot) {
        await sessionStore.restoreSnapshot(snapshot)
      }
    } catch (error) {
      console.error('Failed to revive session:', error)
    } finally {
      setReviving(null)
    }
  }

  const handleDelete = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      await sessionStore.deleteSession(sessionId)
    }
  }

  const handleMarkHistorical = async (sessionId: string) => {
    await sessionStore.markSessionHistorical(sessionId)
  }

  const renderSession = (session: Session, type: 'active' | 'dormant' | 'historical') => (
    <div
      key={session.id}
      style={{
        padding: '12px',
        margin: '8px 0',
        background: type === 'dormant' ? '#fff3cd' : type === 'historical' ? '#f8d7da' : '#d1ecf1',
        border: '1px solid',
        borderColor: type === 'dormant' ? '#ffc107' : type === 'historical' ? '#dc3545' : '#0dcaf0',
        borderRadius: '4px',
        fontSize: '14px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {getSessionTitle(session)}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            {formatDate(session.lastActive)}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            Device: {session.deviceId.slice(-8)} | Tab: {session.tabId.slice(-8)}
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
            {session.activities.length} activities
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={() => handleRevive(session.id)}
            disabled={reviving === session.id}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: '#0d6efd',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: reviving === session.id ? 'wait' : 'pointer',
              opacity: reviving === session.id ? 0.6 : 1
            }}
          >
            {reviving === session.id ? 'Reviving...' : 'Revive'}
          </button>
          {type === 'active' && (
            <button
              onClick={() => handleMarkHistorical(session.id)}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Archive
            </button>
          )}
          <button
            onClick={() => handleDelete(session.id)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {session.snapshot.url && (
        <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', wordBreak: 'break-all' }}>
          URL: {session.snapshot.url}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#0d6efd',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Session Sync Panel"
      >
        ⏱️
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '80vh',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 10000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8f9fa'
            }}
          >
            <h2 style={{ margin: 0, fontSize: '18px' }}>Session Sync</h2>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {/* Current Session */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
                Current Session
              </h3>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Device: {state.deviceId.slice(-8)} | Tab: {state.tabId.slice(-8)}
              </div>
            </div>

            {/* Active Sessions */}
            {state.sessions.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
                  Active Sessions ({state.sessions.length})
                </h3>
                {state.sessions.map((session) => renderSession(session, 'active'))}
              </div>
            )}

            {/* Dormant Sessions (Least Recently Used First) */}
            {state.dormantSessions.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
                  Dormant Sessions ({state.dormantSessions.length})
                  <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '8px' }}>
                    (Least recently used first)
                  </span>
                </h3>
                {state.dormantSessions.map((session) => renderSession(session, 'dormant'))}
              </div>
            )}

            {/* Historical Sessions (Least Recently Used First) */}
            {state.historicalSessions.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
                  Historical Sessions ({state.historicalSessions.length})
                  <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '8px' }}>
                    (Least recently used first)
                  </span>
                </h3>
                {state.historicalSessions.map((session) => renderSession(session, 'historical'))}
              </div>
            )}

            {/* Empty State */}
            {state.sessions.length === 0 && 
             state.dormantSessions.length === 0 && 
             state.historicalSessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                <div style={{ fontSize: '16px' }}>No sessions found</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  Open new tabs to see sessions appear here
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9998
          }}
        />
      )}
    </>
  )
}
