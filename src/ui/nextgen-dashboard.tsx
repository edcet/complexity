import React, { useEffect, useMemo, useState } from 'react';

// TODO: Replace these stub types/hooks with real imports from your modules
// CLI Sync
// import { useCliSync, useCliLogsStream } from '../cli-sync/hooks';
// Resilient DOM
// import { useResilientDom, useTrackedElements } from '../resilient-dom/hooks';
// WASM Runtime
// import { useWasmRegistry, useWasmPlugins } from '../wasm-runtime/hooks';
// Homelab Mesh
// import { useMeshTopology, useMeshPeers, useMeshServices } from '../homelab-mesh/hooks';

// ---- Stubbed hooks & types for scaffolding ----
type CliSyncStatus = {
  connected: boolean;
  lastSync?: string;
  inProgress?: boolean;
  error?: string | null;
};

function useCliSyncStub(): CliSyncStatus {
  const [state, setState] = useState<CliSyncStatus>({ connected: false, inProgress: false, error: null });
  // TODO: wire to real cli-sync status stream
  useEffect(() => {
    // placeholder effect simulating status updates
  }, []);
  return state;
}

function useCliLogsStreamStub(): string[] {
  const [logs, setLogs] = useState<string[]>([]);
  // TODO: wire to real streaming logs (EventSource/WebSocket/stdout tail)
  useEffect(() => {
    // placeholder timer to simulate log streaming
    const id = setInterval(() => setLogs((l) => l.slice(-199).concat(`[stub] ${new Date().toISOString()} heartbeat`)), 5000);
    return () => clearInterval(id);
  }, []);
  return logs;
}

type TrackedElementHealth = {
  selector: string;
  present: boolean;
  lastSeen?: string;
  failures?: number;
};

function useTrackedElementsStub(): TrackedElementHealth[] {
  // TODO: connect to resilient-dom tracker cache/state
  return useMemo(
    () => [
      { selector: '#root', present: true, lastSeen: new Date().toISOString(), failures: 0 },
      { selector: '.status-banner', present: false, lastSeen: undefined, failures: 3 },
    ],
    []
  );
}

type WasmPlugin = {
  id: string;
  name: string;
  version?: string;
  enabled?: boolean;
};

function useWasmPluginsStub(): WasmPlugin[] {
  // TODO: connect to wasm-runtime registry
  return useMemo(
    () => [
      { id: 'wasm:kv', name: 'KeyValue Store', version: '0.1.0', enabled: true },
      { id: 'wasm:viz', name: 'Graph Viz', version: '0.2.3', enabled: false },
    ],
    []
  );
}

type MeshNode = { id: string; role?: string; status: 'online' | 'offline' | 'degraded'; };
type MeshPeer = { id: string; latencyMs?: number; status: 'connected' | 'disconnected'; };
type MeshService = { name: string; port?: number; status: 'ready' | 'starting' | 'failed'; };

function useMeshTopologyStub(): { nodes: MeshNode[]; peers: MeshPeer[]; services: MeshService[] } {
  // TODO: connect to homelab-mesh topology, peer sync, and service discovery
  return useMemo(
    () => ({
      nodes: [
        { id: 'node-a', role: 'controller', status: 'online' },
        { id: 'node-b', role: 'worker', status: 'degraded' },
      ],
      peers: [
        { id: 'peer-1', latencyMs: 23, status: 'connected' },
        { id: 'peer-2', latencyMs: 88, status: 'disconnected' },
      ],
      services: [
        { name: 'mesh-api', port: 8787, status: 'ready' },
        { name: 'sync-relay', port: 9000, status: 'starting' },
      ],
    }),
    []
  );
}

// ---- Component ----
export type NextgenDashboardProps = {
  className?: string;
  // allow overrides to inject real hooks during integration/testing
  hooks?: {
    useCliSync?: () => CliSyncStatus;
    useCliLogs?: () => string[];
    useTrackedElements?: () => TrackedElementHealth[];
    useWasmPlugins?: () => WasmPlugin[];
    useMeshTopology?: () => { nodes: MeshNode[]; peers: MeshPeer[]; services: MeshService[] };
  };
};

const Section: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
    </header>
    <div>{children}</div>
  </section>
);

export const NextgenDashboard: React.FC<NextgenDashboardProps> = ({ className, hooks }) => {
  // Wire stubs by default; allow injection via props.hooks for tests/live wiring
  const useCliSync = hooks?.useCliSync ?? useCliSyncStub;
  const useCliLogs = hooks?.useCliLogs ?? useCliLogsStreamStub;
  const useTrackedElements = hooks?.useTrackedElements ?? useTrackedElementsStub;
  const useWasmPlugins = hooks?.useWasmPlugins ?? useWasmPluginsStub;
  const useMeshTopology = hooks?.useMeshTopology ?? useMeshTopologyStub;

  // Data
  const cliStatus = useCliSync();
  const cliLogs = useCliLogs();
  const tracked = useTrackedElements();
  const { nodes, peers, services } = useMeshTopology();
  const plugins = useWasmPlugins();

  // User action handlers (placeholders)
  const onConnectCli = () => {
    // TODO: trigger CLI connect sequence
    console.debug('connect CLI [TODO]');
  };
  const onReloadCli = () => {
    // TODO: trigger sync reload
    console.debug('reload CLI sync [TODO]');
  };
  const onBroadcast = () => {
    // TODO: trigger mesh broadcast
    console.debug('mesh broadcast [TODO]');
  };
  const onTrackElement = () => {
    // TODO: open modal/prompt to add selector to resilient-dom tracker
    console.debug('track element [TODO]');
  };
  const onReloadPlugins = () => {
    // TODO: re-scan/reload wasm registry
    console.debug('reload plugins [TODO]');
  };

  return (
    <div className={className} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
      {/* 1) CLI sync status and streaming logs */}
      <Section
        title="CLI Sync"
        actions={
          <>
            <button onClick={onConnectCli} disabled={cliStatus.inProgress} title="Connect to CLI">
              {cliStatus.connected ? 'Connected' : 'Connect'}
            </button>
            <button onClick={onReloadCli} title="Reload sync">Reload</button>
          </>
        }
      >
        <div style={{ fontSize: 12, color: '#374151' }}>
          <div>Status: {cliStatus.connected ? 'Connected' : cliStatus.inProgress ? 'Connecting…' : 'Disconnected'}</div>
          {cliStatus.lastSync && <div>Last sync: {cliStatus.lastSync}</div>}
          {cliStatus.error && <div style={{ color: '#b91c1c' }}>Error: {cliStatus.error}</div>}
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Logs</div>
          <div style={{ height: 160, overflow: 'auto', background: '#0b1021', color: '#e5e7eb', padding: 8, borderRadius: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}>
            {cliLogs.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No logs yet. TODO: wire real stream.</div>
            ) : (
              <pre style={{ margin: 0 }}>{cliLogs.join('\n')}</pre>
            )}
          </div>
        </div>
      </Section>

      {/* 2) Resilient DOM tracked elements and health */}
      <Section
        title="Resilient DOM"
        actions={<button onClick={onTrackElement} title="Track element">Track</button>}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tracked.map((t) => (
            <li key={t.selector} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace' }}>{t.selector}</span>
              <span>
                <span style={{ padding: '2px 6px', borderRadius: 4, background: t.present ? '#d1fae5' : '#fee2e2', color: t.present ? '#065f46' : '#991b1b' }}>
                  {t.present ? 'present' : 'missing'}
                </span>
                {typeof t.failures === 'number' && t.failures > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>fails: {t.failures}</span>
                )}
                {t.lastSeen && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>last: {t.lastSeen}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 3) WASM plugin registry and entries */}
      <Section
        title="WASM Plugins"
        actions={<button onClick={onReloadPlugins} title="Reload plugins">Reload</button>}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plugins.map((p) => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>{p.name}</strong>
                <span style={{ marginLeft: 6, color: '#6b7280' }}>({p.id})</span>
                {p.version && <span style={{ marginLeft: 6, color: '#6b7280' }}>v{p.version}</span>}
              </span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: p.enabled ? '#d1fae5' : '#f3f4f6', color: p.enabled ? '#065f46' : '#374151' }}>
                {p.enabled ? 'enabled' : 'disabled'}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 4) Mesh node/peer/service statuses */}
      <Section
        title="Mesh Topology"
        actions={<button onClick={onBroadcast} title="Broadcast control message">Broadcast</button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Nodes</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nodes.map((n) => (
                <li key={n.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {n.id}
                    {n.role && <span style={{ marginLeft: 6, color: '#6b7280' }}>({n.role})</span>}
                  </span>
                  <span style={{ padding: '2px 6px', borderRadius: 4, background: n.status === 'online' ? '#d1fae5' : n.status === 'degraded' ? '#fef3c7' : '#fee2e2', color: n.status === 'online' ? '#065f46' : n.status === 'degraded' ? '#92400e' : '#991b1b' }}>
                    {n.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Peers</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {peers.map((p) => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.id}</span>
                  <span>
                    {typeof p.latencyMs === 'number' && (
                      <span style={{ marginRight: 8, color: '#6b7280' }}>{p.latencyMs} ms</span>
                    )}
                    <span style={{ padding: '2px 6px', borderRadius: 4, background: p.status === 'connected' ? '#d1fae5' : '#fee2e2', color: p.status === 'connected' ? '#065f46' : '#991b1b' }}>
                      {p.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Services</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {services.map((s) => (
                <li key={s.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {s.name}
                    {typeof s.port === 'number' && <span style={{ marginLeft: 6, color: '#6b7280' }}>:{s.port}</span>}
                  </span>
                  <span style={{ padding: '2px 6px', borderRadius: 4, background: s.status === 'ready' ? '#d1fae5' : s.status === 'starting' ? '#fef3c7' : '#fee2e2', color: s.status === 'ready' ? '#065f46' : s.status === 'starting' ? '#92400e' : '#991b1b' }}>
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* TODOs:
        - Replace stub hooks with real hooks from cli-sync, resilient-dom, wasm-runtime, and homelab-mesh
        - Wire actual event streams (WebSocket/EventSource/RPC) for logs, topology updates, health
        - Add error/loading states and retries
        - Add filters, search, and layout polish; convert to design system components if available
        - Provide callback props for advanced control and external orchestration
      */}
    </div>
  );
};

export default NextgenDashboard;
