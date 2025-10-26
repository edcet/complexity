/**
 * wasm-runtime: Loader, sandbox, registry for WASM plugins
 *
 * This module provides:
 * 1) WasmPluginLoader - loading/validating WASM plugins and instantiation
 * 2) WasmSandbox - security/context isolation with bridge stubs for messaging and syscalls
 * 3) PluginRegistry - manage, discover, and hot-reload plugins
 * 4) Types/interfaces, hooks, and doc comments for plugin API bindings
 *
 * TODO:
 * - Native/binary frame support (Interface Types, component model adapters)
 * - Manifest schema validation and signature checks
 * - Policy checks (capabilities, resource quotas, network/fs access)
 */

// ---------- Types & Interfaces ----------
export type PluginId = string;
export type PluginVersion = string;

export interface PluginManifest {
  id: PluginId;
  name: string;
  version: PluginVersion;
  entry?: string; // optional exported entry function name (default 'entry')
  permissions?: string[]; // declared capabilities
  wasi?: boolean; // requires WASI-like imports
  // TODO: extend with integrity/signature fields and component model metadata
}

export interface PluginModule {
  manifest: PluginManifest;
  source: ArrayBuffer; // raw .wasm bytes
  url?: string; // origin for discovery and hot reload
}

export interface SandboxPolicy {
  memoryLimitPages?: number; // 64KiB pages
  fuel?: number; // optional instruction fuel for metering
  allowNetwork?: boolean;
  allowFS?: boolean;
  env?: Record<string, string>;
}

export interface PluginContext {
  manifest: PluginManifest;
  policy: SandboxPolicy;
  // bridge channels (stubs) for host<->guest messaging
  postMessage: (msg: unknown) => void;
  addEventListener: (type: string, handler: (e: unknown) => void) => () => void;
}

export interface PluginInstance {
  id: PluginId;
  instance: WebAssembly.Instance;
  module: WebAssembly.Module;
  memory?: WebAssembly.Memory;
  exports: Record<string, any>;
  sandbox: WasmSandbox;
}

export type LoaderResult = PluginInstance;

// Hook to construct runtime with sensible defaults
export function useWasmRuntime(defaultPolicy: SandboxPolicy = {}) {
  const loader = new WasmPluginLoader();
  const registry = new PluginRegistry(loader, defaultPolicy);
  return { loader, registry };
}

// ---------- WasmSandbox ----------
export class WasmSandbox {
  readonly policy: SandboxPolicy;
  readonly context: PluginContext;

  constructor(manifest: PluginManifest, policy: SandboxPolicy = {}) {
    this.policy = policy;
    // Create bridge stubs. In a browser extension, these would connect to runtime messaging.
    const listeners = new Map<string, Set<(e: unknown) => void>>();
    const postMessage = (msg: unknown) => {
      // TODO: route to extension/background or worker message channel
      console.debug('[wasm-sandbox] postMessage', manifest.id, msg);
    };
    const addEventListener = (type: string, handler: (e: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
      return () => listeners.get(type)!.delete(handler);
    };
    this.context = { manifest, policy, postMessage, addEventListener };
  }

  // Build importObject with minimal safe surface
  buildImports(memory?: WebAssembly.Memory): WebAssembly.Imports {
    const env: Record<string, any> = {
      // Basic debugging hooks
      __log_i32: (x: number) => console.log('[wasm]', x),
      __log_f64: (x: number) => console.log('[wasm]', x),
    };

    if (this.policy.env) {
      // Expose env variables via simple getters (guest calls host to read)
      env.__get_env = (ptr: number, len: number) => {
        // TODO: marshalling via memory; placeholder no-op
        console.warn('[wasm] __get_env called but not implemented');
        return 0;
      };
    }

    const imports: WebAssembly.Imports = { env };

    // TODO: supply WASI shims when manifest.wasi === true
    // e.g., fd_write, random_get via crypto.getRandomValues, clock_time_get, etc.

    return imports;
  }
}

// ---------- WasmPluginLoader ----------
export class WasmPluginLoader {
  async load(module: PluginModule, policy: SandboxPolicy = {}): Promise<LoaderResult> {
    // Validate basic manifest shape
    this.validateManifest(module.manifest);

    // Optional: compile streaming when URL available
    let compiled: WebAssembly.Module;
    if (module.url && module.source.byteLength === 0) {
      const resp = await fetch(module.url);
      if (!resp.ok) throw new Error(`Failed to fetch wasm: ${resp.status}`);
      const buf = await resp.arrayBuffer();
      compiled = await WebAssembly.compile(buf);
      module.source = buf;
    } else {
      compiled = await WebAssembly.compile(module.source);
    }

    // Memory and sandbox
    const memory = new WebAssembly.Memory({
      initial: policy.memoryLimitPages ?? 2,
      maximum: policy.memoryLimitPages ?? 256,
    });

    const sandbox = new WasmSandbox(module.manifest, policy);
    const imports = sandbox.buildImports(memory);

    // Instantiate with provided imports
    const instance = await WebAssembly.instantiate(compiled, imports);

    // Extract exports and find entry
    const exports = instance.exports as Record<string, any>;
    const entryName = module.manifest.entry ?? 'entry';
    const entry = exports[entryName];
    if (entry && typeof entry !== 'function') {
      throw new Error(`Entry export '${entryName}' is not a function`);
    }

    const plugin: PluginInstance = {
      id: module.manifest.id,
      instance: instance as WebAssembly.Instance,
      module: compiled,
      memory,
      exports,
      sandbox,
    };

    // Optionally call entry for initialization
    try {
      if (typeof entry === 'function') entry();
    } catch (err) {
      console.warn('[wasm-runtime] entry() threw', err);
    }

    return plugin;
  }

  validateManifest(manifest: PluginManifest) {
    if (!manifest || !manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Invalid manifest: id, name, version required');
    }
    // TODO: JSON schema validation, cryptographic signature, component model checks
  }
}

// ---------- PluginRegistry ----------
export class PluginRegistry {
  private plugins = new Map<PluginId, PluginInstance>();

  constructor(private loader: WasmPluginLoader, private defaultPolicy: SandboxPolicy = {}) {}

  has(id: PluginId) { return this.plugins.has(id); }
  get(id: PluginId) { return this.plugins.get(id); }
  list() { return Array.from(this.plugins.values()); }

  async register(module: PluginModule, policy?: SandboxPolicy): Promise<PluginInstance> {
    const instance = await this.loader.load(module, policy ?? this.defaultPolicy);
    this.plugins.set(module.manifest.id, instance);
    return instance;
  }

  async unregister(id: PluginId): Promise<void> {
    const inst = this.plugins.get(id);
    if (inst) {
      // Best-effort teardown hooks
      const dtor = inst.exports?.destroy || inst.exports?.deinit || inst.exports?.free;
      try { if (typeof dtor === 'function') dtor(); } catch {}
      this.plugins.delete(id);
    }
  }

  // Discover from URL and support hot reloading via ETag/Last-Modified
  async upsertFromUrl(url: string, manifest: PluginManifest, policy?: SandboxPolicy): Promise<PluginInstance> {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to fetch plugin ${manifest.id}: ${res.status}`);
    const buf = await res.arrayBuffer();
    const module: PluginModule = { manifest, source: buf, url };
    return this.register(module, policy);
  }

  // Hot reload: replace instance when underlying bytes change
  async hotReload(id: PluginId): Promise<PluginInstance | null> {
    const current = this.plugins.get(id);
    if (!current || !current.sandbox.context.manifest) return null;
    const url = (current.sandbox.context.manifest as any).url || (current as any).url;
    const manifest = current.sandbox.context.manifest;
    if (!url) return null;
    return this.upsertFromUrl(url, manifest);
  }
}

// ---------- Extension/Browser View Helpers ----------
/**
 * Provide a minimal adapter so this module can be safely imported in both
 * browser and extension contexts. No side effects on import.
 */
export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!(chrome as any).runtime;
}

export function getBrowserInfo() {
  const ua = (globalThis.navigator?.userAgent ?? '').toLowerCase();
  return {
    isFirefox: ua.includes('firefox'),
    isChromium: ua.includes('chrome') || ua.includes('edg'),
    ua,
  };
}
