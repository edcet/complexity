import React, { useEffect, useMemo, useState, useCallback } from 'react';
// Wire real hooks from modules (assumes these exports exist)
import { useCliSync, useCliLogsStream, onCliEvent } from '../cli-sync/hooks';
import { useTrackedElements, trackNewSelector } from '../resilient-dom/hooks';
import { useWasmPlugins, onRegistryEvent } from '../wasm-runtime/hooks';
import { useMeshTopology, onMeshEvent } from '../homelab-mesh/hooks';

// TODOs:
// - Replace placeholder on* event emitters with real event bus or API calls
// - Ensure hooks stream live updates (WebSocket/EventSource/RPC) and respect autoRefresh
// - Add design system components and accessibility polish
// - Add unit/e2e tests for filters, sorting, and modal interactions
// - Provide callback props for external orchestration and fine-grained control

export type NextgenDashboardProps = {
  className?: string;
  hooks?: {
    useCliSync?: typeof useCliSync;
    useCliLogs?: typeof useCliLogsStream;
    useTrackedElements?: typeof useTrackedElements;
    useWasmPlugins?: typeof useWasmPlugins;
    useMeshTopology?: typeof useMeshTopology;
  };
};

const Section: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #e1e4e8', borderRadius: 8, padding: 12 }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
    </header>
    {children}
  </section>
);

export const NextgenDashboard: React.FC<NextgenDashboardProps> = ({ className, hooks }) => {
  // Allow injection for tests/live overrides
  const useCliSyncHook = hooks?.useCliSync ?? useCliSync;
  const useCliLogsHook = hooks?.useCliLogs ?? useCliLogsStream;
  const useTrackedElementsHook = hooks?.useTrackedElements ?? useTrackedElements;
  const useWasmPluginsHook = hooks?.useWasmPlugins ?? useWasmPlugins;
  const useMeshTopologyHook = hooks?.useMeshTopology ?? useMeshTopology;

  // Data from hooks
  const cliStatus = useCliSyncHook(); // {connected, inProgress, lastSync, error}
  const cliLogs = useCliLogsHook(); // string[]
  const tracked = useTrackedElementsHook(); // TrackedElementHealth[]
  const topo = useMeshTopologyHook();
  const nodes = (topo as any)?.nodes ?? [];
  const peers = (topo as any)?.peers ?? [];
  const services = (topo as any)?.services ?? [];
  const meshError = (topo as any)?.error as unknown as string | undefined;
  const meshLoading = (topo as any)?.loading as unknown as boolean | undefined;
  const plugins = useWasmPluginsHook(); // WasmPlugin[]

  // Local UI state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logFilter, setLogFilter] = useState('');
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [newSelector, setNewSelector] = useState('');
  const [peersSort, setPeersSort] = useState<'latency' | 'status' | 'id'>('status');
  const [servicesSort, setServicesSort] = useState<'name' | 'port' | 'status'>('status');
  const [uiError, setUiError] = useState<string | null>(null);

  // Event listeners (stubs to wire to real event bus/APIs)
  useEffect(() => {
    const offCliConnect = onCliEvent?.('connect', () => console.debug('[cli] connected'));
    const offCliDisconnect = onCliEvent?.('disconnect', () => console.debug('[cli] disconnected'));
    const offRegistry = onRegistryEvent?.('update', () => console.debug('[wasm] registry update'));
    const offMesh = onMeshEvent?.('node-status', (p: any) => console.debug('[mesh] node status', p));
    return () => {
      offCliConnect?.();
      offCliDisconnect?.();
      offRegistry?.();
      offMesh?.();
    };
  }, []);

  // Actions
  const onConnectCli = useCallback(() => {
    try {
      onCliEvent?.('request-connect');
      console.debug('connect CLI requested');
    } catch (e: any) {
      setUiError(e?.message ?? 'Failed to request CLI connect');
    }
  }, []);

  const onReloadCli = useCallback(() => {
    try {
      onCliEvent?.('request-reload');
      console.debug('reload CLI sync requested');
    } catch (e: any) {
      setUiError(e?.message ?? 'Failed to request CLI reload');
    }
  }, []);

  const onBroadcast = useCallback(() => {
    try {
      onMeshEvent?.('broadcast');
      console.debug('mesh broadcast requested');
    } catch (e: any) {
      setUiError(e?.message ?? 'Failed to broadcast');
    }
  }, []);

  const onReloadPlugins = useCallback(() => {
    try {
      onRegistryEvent?.('request-reload');
      console.debug('reload plugins requested');
    } catch (e: any) {
      setUiError(e?.message ?? 'Failed to reload plugins');
    }
  }, []);

  const onTrackElementOpen = () => setShowTrackModal(true);
  const onTrackElementSubmit = async () => {
    try {
      if (newSelector.trim()) await trackNewSelector(newSelector.trim());
      setShowTrackModal(false);
      setNewSelector('');
    } catch (e: any) {
      setUiError(e?.message ?? 'Failed to track selector');
    }
  };

  // Derived data
  const filteredLogs = useMemo(() => {
    if (!logFilter) return cliLogs;
    const q = logFilter.toLowerCase();
    return cliLogs.filter((l) => l.toLowerCase().includes(q));
  }, [cliLogs, logFilter]);

  const sortedPeers = useMemo(() => {
    const arr = [...(peers ?? [])];
    switch (peersSort) {
      case 'latency':
        return arr.sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));
      case 'id':
        return arr.sort((a, b) => a.id.localeCompare(b.id));
      default:
        return arr.sort((a, b) => a.status.localeCompare(b.status));
    }
  }, [peers, peersSort]);

  const sortedServices = useMemo(() => {
    const arr = [...(services ?? [])];
    switch (servicesSort) {
      case 'name':
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case 'port':
        return arr.sort((a, b) => (a.port ?? 0) - (b.port ?? 0));
      default:
        return arr.sort((a, b) => a.status.localeCompare(b.status));
    }
  }, [services, servicesSort]);

  // Auto-refresh toggle hint: hooks should internally respect polling/streaming; here we only show UI toggle
  useEffect(() => {
    // Placeholder for wiring autoRefresh to hooks/providers
    console.debug('autoRefresh:', autoRefresh);
  }, [autoRefresh]);

  return (
    <div className={className} style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(300px, 1fr)', minWidth: 0 }}>
      {/* Top status/errors */}
      {(uiError || cliStatus?.error || meshError) && (
        <div style={{ color: 'crimson' }}>
          {uiError && <div>Error: {uiError}</div>}
          {cliStatus?.error && <div>CLI: {cliStatus.error}</div>}
          {meshError && <div>Mesh: {String(meshError)}</div>}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Auto-refresh
        </label>
      </div>

      {/* 1) CLI sync status and streaming logs */}
      <Section
        title="CLI Sync"
        actions={
          <>
            <button onClick={onConnectCli} disabled={!!cliStatus?.inProgress} title="Connect to CLI">
              {cliStatus?.connected ? 'Connected' : 'Connect'}
            </button>
            <button onClick={onReloadCli} title="Reload sync">Reload</button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: '#333' }}>
          Status: {cliStatus?.connected ? 'Connected' : cliStatus?.inProgress ? 'Connecting…' : 'Disconnected'}
          {cliStatus?.lastSync && <> · Last sync: {cliStatus.lastSync}</>}
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Logs</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              placeholder="Filter logs..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={() => setLogFilter('')}>Clear</button>
          </div>
          <div style={{ background: '#0a0a0a', color: '#eaeaea', borderRadius: 6, padding: 8, height: 200, overflow: 'auto', fontFamily: 'Consolas, Menlo, Monaco, SFMono-Regular, ui-monospace, monospace', fontSize: 12 }}>
            {filteredLogs.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No logs yet. TODO: wire real stream.</div>
            ) : (
              <pre style={{ margin: 0 }}>{filteredLogs.join('\n')}</pre>
            )}
          </div>
        </div>
      </Section>

      {/* 2) Resilient DOM tracked elements and health */}
      <Section
        title="Resilient DOM"
        actions={<button onClick={onTrackElementOpen} title="Track element">Track</button>}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tracked.map((t) => (
            <li key={t.selector} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{t.selector}</span>
              <span>
                <span style={{ padding: '2px 6px', borderRadius: 6, background: t.present ? '#e6ffed' : '#ffeef0', color: t.present ? '#0969da' : '#d1242f' }}>
                  {t.present ? 'present' : 'missing'}
                </span>
                {typeof t.failures === 'number' && t.failures > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>fails: {t.failures}</span>
                )}
                {t.lastSeen && <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>last: {t.lastSeen}</span>}
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
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plugins.map((p) => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                {p.name}
                <span style={{ marginLeft: 6, color: '#666' }}>({p.id})</span>
                {p.version && <span style={{ marginLeft: 6, color: '#666' }}>v{p.version}</span>}
              </span>
              <span style={{ padding: '2px 6px', borderRadius: 6, background: p.enabled ? '#e6ffed' : '#f6f8fa', color: p.enabled ? '#1a7f37' : '#57606a' }}>
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
        {meshLoading && <div style={{ color: '#666' }}>Loading mesh…</div>}
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nodes</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nodes.map((n: any) => (
                <li key={n.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {n.id}
                    {n.role && <span style={{ marginLeft: 6, color: '#666' }}>({n.role})</span>}
                  </span>
                  <span style={{ padding: '2px 6px', borderRadius: 6, background: n.status === 'online' ? '#e6ffed' : n.status === 'degraded' ? '#fff8e1' : '#ffeef0', color: '#444' }}>
                    {n.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>Peers</div>
              <select value={peersSort} onChange={(e) => setPeersSort(e.target.value as any)}>
                <option value="status">Sort: status</option>
                <option value="latency">Sort: latency</option>
                <option value="id">Sort: id</option>
              </select>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedPeers.map((p: any) => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {p.id}
                    {typeof p.latencyMs === 'number' && (
                      <span style={{ marginLeft: 6, color: '#666' }}>{p.latencyMs} ms</span>
                    )}
                  </span>
                  <span style={{ padding: '2px 6px', borderRadius: 
