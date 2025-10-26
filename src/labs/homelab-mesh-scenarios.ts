// src/labs/homelab-mesh-scenarios.ts
// Scenario-driven cross-module validation for homelab mesh
// Metacognitive schema: evidence, layering, validation

/*
Overview
- Simulates: node join/leave, peer churn, service directory updates, failover, broadcast
- Validates: event hooks, health propagation, logging
- Integrations: CLI sync, dashboard UI hooks, WASM plugin actions (stubs)
- Multi-pass assertions at each stage using evidence->layering->validation
*/

// Lightweight types to avoid coupling; adapt to real modules when wiring
export type NodeId = string;
export type ServiceId = string;

export interface MeshEvent {
  type: string;
  node?: NodeId;
  service?: ServiceId;
  payload?: unknown;
  ts: number;
}

export interface HealthStatus {
  node: NodeId;
  healthy: boolean;
  reasons: string[];
  updatedAt: number;
}

export interface ServiceDirectory {
  services: Record<ServiceId, { providers: NodeId[]; version: string; updatedAt: number }>;
}

export interface LoggerLike {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
}

export interface MeshHarness {
  // Observability
  events: MeshEvent[];
  health: Map<NodeId, HealthStatus>;
  directory: ServiceDirectory;
  logs: string[];

  // Controls (stubs that test can spy on)
  addNode: (id: NodeId) => void;
  removeNode: (id: NodeId) => void;
  updateServiceProviders: (svc: ServiceId, providers: NodeId[], version?: string) => void;
  failNode: (id: NodeId) => void;
  broadcast: (topic: string, message: unknown) => void;

  // Integrations (stubs)
  cliSync: (args: string[]) => Promise<{ code: number; out: string; err?: string }>;
  dashboardHook: (evt: MeshEvent) => void;
  wasmPluginAction: (action: string, input: unknown) => Promise<unknown>;

  logger: LoggerLike;
}

// Utilities
const now = () => Date.now();

function recordEvent(h: MeshHarness, e: Omit<MeshEvent, 'ts'>) {
  const evt: MeshEvent = { ...e, ts: now() };
  h.events.push(evt);
  try { h.dashboardHook(evt); } catch {}
  h.logger.info('[event]', e.type, e.node ?? '', e.service ?? '', e.payload ?? '');
}

function log(h: MeshHarness, level: 'info'|'warn'|'error'|'debug', msg: string, ...rest: any[]) {
  const line = `[${level}] ${msg} ${rest.map(String).join(' ')}`.trim();
  h.logs.push(line);
  (h.logger[level] ?? h.logger.info).call(h.logger, msg, ...rest);
}

// Assertion helpers with multi-pass schema
export interface AssertionPass {
  name: string;
  evidence: () => unknown;          // collect raw state
  layering: (e: unknown) => unknown; // transform to comparable view
  validation: (l: unknown) => void;  // throw on failure
}

export function runPass(pass: AssertionPass) {
  const e = pass.evidence();
  const l = pass.layering(e);
  pass.validation(l);
}

export interface ScenarioResult {
  name: string;
  passes: { name: string; ok: boolean; error?: unknown }[];
}

function tryPass(p: AssertionPass): { name: string; ok: boolean; error?: unknown } {
  try {
    runPass(p);
    return { name: p.name, ok: true };
  } catch (err) {
    return { name: p.name, ok: false, error: err };
  }
}

// Build a default in-memory harness with stubbed integrations
export function createHarness(logger: LoggerLike = console): MeshHarness {
  const health = new Map<NodeId, HealthStatus>();
  const directory: ServiceDirectory = { services: {} };
  const events: MeshEvent[] = [];
  const logs: string[] = [];

  const h: MeshHarness = {
    events, health, directory, logs,
    addNode: (id) => {
      health.set(id, { node: id, healthy: true, reasons: [], updatedAt: now() });
      recordEvent(h, { type: 'node.join', node: id });
    },
    removeNode: (id) => {
      health.delete(id);
      // Remove from services
      for (const svc of Object.keys(directory.services)) {
        directory.services[svc].providers = directory.services[svc].providers.filter(p => p !== id);
        directory.services[svc].updatedAt = now();
      }
      recordEvent(h, { type: 'node.leave', node: id });
    },
    updateServiceProviders: (svc, providers, version = 'v1') => {
      directory.services[svc] = directory.services[svc] ?? { providers: [], version: 'v0', updatedAt: 0 };
      directory.services[svc].providers = Array.from(new Set(providers));
      directory.services[svc].version = version;
      directory.services[svc].updatedAt = now();
      recordEvent(h, { type: 'service.update', service: svc, payload: { providers, version } });
    },
    failNode: (id) => {
      const s = health.get(id);
      if (s) {
        s.healthy = false;
        s.reasons.push('manual-fail');
        s.updatedAt = now();
      }
      recordEvent(h, { type: 'node.fail', node: id });
    },
    broadcast: (topic, message) => {
      recordEvent(h, { type: `broadcast.${topic}`, payload: message });
      log(h, 'debug', `broadcast ${topic}`, JSON.stringify(message));
    },
    // Integration stubs: replace with real wiring
    cliSync: async (args) => {
      log(h, 'info', 'cli.sync', args.join(' '));
      return { code: 0, out: `ok ${args.join(' ')}` };
    },
    dashboardHook: (_evt) => void 0,
    wasmPluginAction: async (action, input) => {
      log(h, 'info', 'wasm.action', action);
      return { action, input, ok: true };
    },
    logger,
  };

  return h;
}

// Scenario 1: Node join/leave sequence
export async function scenarioNodeLifecycle(h: MeshHarness) {
  const name = 'node-lifecycle';
  const passes: ScenarioResult['passes'] = [];

  h.addNode('n1');
  h.addNode('n2');
  h.removeNode('n2');

  passes.push(tryPass({
    name: 'health-tracks-joins',
    evidence: () => Array.from(h.health.values()).map(s => ({ node: s.node, healthy: s.healthy })),
    layering: (e) => e,
    validation: (l: any[]) => {
      const nodes = l.map(x => x.node);
      if (!nodes.includes('n1')) throw new Error('n1 missing');
      if (nodes.includes('n2')) throw new Error('n2 should be removed');
    },
  }));

  passes.push(tryPass({
    name: 'events-capture-join-leave',
    evidence: () => h.events.filter(e => e.type === 'node.join' || e.type === 'node.leave'),
    layering: (e) => e.map((x: MeshEvent) => x.type + ':' + (x.node ?? '')),
    validation: (l: string[]) => {
      const s = l.join('|');
      if (!s.includes('node.join:n1')) throw new Error('missing join n1');
      if (!s.includes('node.join:n2')) throw new Error('missing join n2');
      if (!s.includes('node.leave:n2')) throw new Error('missing leave n2');
    },
  }));

  return { name, passes } satisfies ScenarioResult;
}

// Scenario 2: Peer churn and stabilization
export async function scenarioPeerChurn(h: MeshHarness) {
  const name = 'peer-churn';
  const passes: ScenarioResult['passes'] = [];

  h.addNode('a'); h.addNode('b'); h.addNode('c');
  h.failNode('b');
  h.removeNode('c');

  passes.push(tryPass({
    name: 'health-propagation',
    evidence: () => ({
      a: h.health.get('a'),
      b: h.health.get('b'),
      c: h.health.get('c'),
    }),
    layering: (e: any) => ({
      a: e.a?.healthy, b: e.b?.healthy, c: e.c?.healthy,
    }),
    validation: (l) => {
      if (l.a !== true) throw new Error('a should be healthy');
      if (l.b !== false) throw new Error('b should be failed');
      if (l.c !== undefined) throw new Error('c should be absent');
    },
  }));

  passes.push(tryPass({
    name: 'logs-contain-failure',
    evidence: () => h.events.filter(e => e.type === 'node.fail' && e.node === 'b'),
    layering: (e) => e.length,
    validation: (len: number) => { if (len < 1) throw new Error('no node.fail for b'); },
  }));

  return { name, passes } satisfies ScenarioResult;
}

// Scenario 3: Service directory updates and versioning
export async function scenarioServiceDirectory(h: MeshHarness) {
  const name = 'service-directory';
  const passes: ScenarioResult['passes'] = [];

  h.addNode('s1'); h.addNode('s2');
  h.updateServiceProviders('svc.http', ['s1'], 'v1');
  h.updateServiceProviders('svc.http', ['s1','s2'], 'v2');

  passes.push(tryPass({
    name: 'directory-updated',
    evidence: () => h.directory.services['svc.http'],
    layering: (e: any) => ({ providers: e?.providers, version: e?.version }),
    validation: (l) => {
      if (!l) throw new Error('missing service');
      if (l.version !== 'v2') throw new Error('version not advanced');
      const set = new Set(l.providers);
      if (!(set.has('s1') && set.has('s2'))) throw new Error('providers not merged');
    },
  }));

  passes.push(tryPass({
    name: 'event-emitted',
    evidence: () => h.events.filter(e => e.type === 'service.update' && e.service === 'svc.http'),
    layering: (e) => e.length,
    validation: (len: number) => { if (len < 2) throw new Error('expected two updates'); },
  }));

  return { name, passes } satisfies ScenarioResult;
}

// Scenario 4: Failover behavior for service providers
export async function scenarioFailover(h: MeshHarness) {
  const name = 'failover';
  const passes: ScenarioResult['passes'] = [];

  h.addNode('p1'); h.addNode('p2');
  h.updateServiceProviders('svc.db', ['p1','p2'], 'v1');
  h.failNode('p1');

  passes.push(tryPass({
    name: 'healthy-provider-remains',
    evidence: () => ({ svc: h.directory.services['svc.db'], health: h.health }),
    layering: (e: any) => ({ providers: e.svc.providers, healthy: Array.from(e.health.entries()) }),
    validation: (l) => {
      const p2 = l.healthy.find(([id, s]: any) => id === 'p2' && s.healthy === true);
      if (!p2) throw new Error('p2 should be healthy for failover');
    },
  }));

  passes.push(tryPass({
    name: 'failure-event-present',
    evidence: () => h.events.some(e => e.type === 'node.fail' && e.node === 'p1'),
    layering: (e) => e,
    validation: (ok: boolean) => { if (!ok) throw new Error('no fail event'); },
  }));

  return { name, passes } satisfies ScenarioResult;
}

// Scenario 5: Broadcast propagation across mesh
export async function scenarioBroadcast(h: MeshHarness) {
  const name = 'broadcast';
  const passes: ScenarioResult['passes'] = [];

  h.addNode('b1'); h.addNode('b2'); h.addNode('b3');
  h.broadcast('topology', { view: ['b1','b2','b3'] });

  passes.push(tryPass({
    name: 'broadcast-event',
    evidence: () => h.events.find(e => e.type === 'broadcast.topology'),
    layering: (e: MeshEvent | undefined) => e?.payload,
    validation: (p: any) => { if (!p?.view || p.view.length !== 3) throw new Error('broadcast payload invalid'); },
  }));

  return { name, passes } satisfies ScenarioResult;
}

// Orchestrator to run all scenarios and surface results
export async function runAllScenarios(h?: MeshHarness) {
  const harness = h ?? createHarness();
  const results: ScenarioResult[] = [];

  results.push(await scenarioNodeLifecycle(harness));
  results.push(await scenarioPeerChurn(harness));
  results.push(await scenarioServiceDirectory(harness));
  results.push(await scenarioFailover(harness));
  results.push(await scenarioBroadcast(harness));

  // CLI sync stub demonstration
  await harness.cliSync(['mesh', 'validate', '--scenarios', String(results.length)]);

  return results;
}

// Export stubs for integration wiring from other modules
export const integrationStubs = {
  withCliSync: (h: MeshHarness, impl: MeshHarness['cliSync']) => { h.cliSync = impl; return h; },
  withDashboardHook: (h: MeshHarness, impl: MeshHarness['dashboardHook']) => { h.dashboardHook = impl; return h; },
  withWasmAction: (h: MeshHarness, impl: MeshHarness['wasmPluginAction']) => { h.wasmPluginAction = impl; return h; },
};
