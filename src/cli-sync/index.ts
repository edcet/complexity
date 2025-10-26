/**
 * CLI-Sync Module
 * Architected scaffold for bidirectional sync between browser/extension and local CLI.
 *
 * Features:
 * - Multi-transport connector (WebSocket, WebTransport, TCP via Deno.connect).
 * - Command queue with backpressure and retries.
 * - Streaming command execution with async iterator and event states: output, error, done.
 * - Hooks for lifecycle and bidirectional file/event sync.
 * - Configurable endpoints, auth, filters, and scheduler.
 */

//#region Types and Config

export type TransportKind = 'websocket' | 'webtransport' | 'tcp' | 'auto';

export interface EndpointConfig {
  /** Preferred transport kind; 'auto' will probe in order: WebTransport, WebSocket, TCP */
  transport?: TransportKind;
  /** WebSocket URL, e.g. ws://127.0.0.1:8787/cli */
  wsUrl?: string;
  /** WebTransport URL, e.g. https://127.0.0.1:8788/cli (H3 + WT) */
  wtUrl?: string;
  /** TCP host (Deno.connect) */
  host?: string;
  /** TCP port (Deno.connect) */
  port?: number;
  /** Optional path namespace for CLI RPC */
  path?: string;
  /** Connection timeout ms */
  timeoutMs?: number;
  /** Retry policy */
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitter?: boolean;
  };
}

export interface AuthConfig {
  /** Bearer token for HTTP-based transports */
  token?: string;
  /** mTLS / client cert PEM (for Deno runtime environments) */
  clientCertPem?: string;
  /** Extra headers for WS/WT handshakes (note: browser WS cannot set headers) */
  headers?: Record<string, string>;
}

export interface FilterRule {
  /** Glob or regex string */
  pattern: string;
  /** Include (true) or exclude (false) */
  include?: boolean;
  /** Event kinds this rule applies to */
  kinds?: Array<'fs' | 'proc' | 'telemetry' | 'custom'>;
}

export interface SchedulerConfig {
  /** Max in-flight commands (concurrency) */
  maxInFlight?: number;
  /** Queue size before backpressure applies */
  maxQueue?: number;
  /** Heartbeat/ping interval ms */
  heartbeatMs?: number;
  /** Idle disconnect timeout ms */
  idleTimeoutMs?: number;
}

export interface SyncConfig {
  endpoints: EndpointConfig;
  auth?: AuthConfig;
  filters?: FilterRule[];
  scheduler?: SchedulerConfig;
  /** Feature flags for experimental capabilities */
  features?: {
    enableFileWatch?: boolean;
    enableTelemetry?: boolean;
    preferBinaryFrames?: boolean;
  };
  /** Logger for debug traces (optional) */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

export type CommandEventKind = 'output' | 'error' | 'done';
export interface CommandEvent<T = unknown> {
  kind: CommandEventKind;
  /** Raw chunk or structured data */
  data?: T;
  /** Optional message */
  message?: string;
  /** Command id this event relates to */
  id: string;
}

export interface CommandRequest {
  id: string;
  command: string;
  args?: string[];
  payload?: unknown;
}

//#endregion

//#region Internal transport abstraction

interface Transport {
  readonly kind: TransportKind;
  connect: () => Promise<void>;
  send: (msg: unknown) => Promise<void>;
  /** Receive raw frames/messages from the CLI */
  onMessage: (handler: (msg: unknown) => void) => void;
  /** Lifecycle events */
  onClose: (handler: (reason?: string) => void) => void;
  close: () => Promise<void>;
  isOpen: () => boolean;
}

/**
 * No-op placeholder transport used before an actual transport is connected.
 */
class NullTransport implements Transport {
  readonly kind: TransportKind = 'auto';
  private open = false;
  async connect(): Promise<void> { this.open = true; }
  async send(): Promise<void> { throw new Error('Transport not connected'); }
  onMessage(): void { /* ignore */ }
  onClose(): void { /* ignore */ }
  async close(): Promise<void> { this.open = false; }
  isOpen(): boolean { return this.open; }
}

//#endregion

//#region CLISyncManager

export class CLISyncManager {
  private transport: Transport = new NullTransport();
  private queue: CommandRequest[] = [];
  private inFlight = new Map<string, (evt: CommandEvent) => void>();
  private cfg: SyncConfig;
  private heartbeatTimer?: number | ReturnType<typeof setInterval>;

  // Hooks for bidirectional sync and lifecycle
  public hooks: {
    onConnect?: () => void;
    onDisconnect?: (reason?: string) => void;
    onMessage?: (raw: unknown) => void;
    onFileEvent?: (path: string, kind: 'create' | 'update' | 'delete') => void;
    onTelemetry?: (data: Record<string, unknown>) => void;
  } = {};

  constructor(cfg: SyncConfig) {
    this.cfg = cfg;
  }

  /**
   * Establish a connection using the configured endpoint strategy.
   * Probes transports when set to 'auto'.
   */
  async connect(): Promise<void> {
    const { endpoints, logger } = this.cfg;
    const transport = await this.selectTransport(endpoints);
    this.transport = transport;
    this.transport.onMessage((msg) => this.handleMessage(msg));
    this.transport.onClose((reason) => this.handleClose(reason));
    await this.transport.connect();
    logger?.info?.(`[cli-sync] connected via ${this.transport.kind}`);
    this.hooks.onConnect?.();
    this.startHeartbeat();
    this.flushQueue();
  }

  /** Send a JSON-serializable message through the transport */
  async send(msg: unknown): Promise<void> {
    if (!this.transport.isOpen()) {
      throw new Error('Transport is not open');
    }
    await this.transport.send(msg);
  }

  /** Enqueue a command; creation of stream happens via executeCommand */
  enqueue(cmd: CommandRequest): void {
    const maxQueue = this.cfg.scheduler?.maxQueue ?? 1024;
    if (this.queue.length >= maxQueue) {
      throw new Error('Command queue capacity exceeded');
    }
    this.queue.push(cmd);
    this.flushQueue();
  }

  /** Process queue respecting maxInFlight */
  private flushQueue(): void {
    const cap = this.cfg.scheduler?.maxInFlight ?? 4;
    while (this.inFlight.size < cap && this.queue.length > 0 && this.transport.isOpen()) {
      const req = this.queue.shift()!;
      const resolver = this.inFlight.get(req.id);
      this.cfg.logger?.debug?.(`[cli-sync] dispatch ${req.id} '${req.command}'`);
      this.transport.send({ type: 'exec', ...req }).catch((err) => {
        this.cfg.logger?.error?.(`[cli-sync] send failed for ${req.id}: ${err}`);
        resolver?.({ kind: 'error', id: req.id, message: String(err) });
        this.inFlight.delete(req.id);
      });
    }
  }

  /** Handle inbound frames from CLI */
  private handleMessage(msg: unknown): void {
    this.hooks.onMessage?.(msg);
    if (typeof msg === 'object' && msg !== null) {
      const anyMsg = msg as Record<string, unknown>;
      const id = String(anyMsg.id ?? '');
      const kind = String(anyMsg.kind ?? '');
      if (id && (kind === 'output' || kind === 'error' || kind === 'done')) {
        const resolver = this.inFlight.get(id);
        resolver?.({
          id,
          kind: kind as CommandEventKind,
          data: anyMsg.data,
          message: typeof anyMsg.message === 'string' ? anyMsg.message : undefined,
        });
        if (kind === 'done' || kind === 'error') {
          this.inFlight.delete(id);
          this.flushQueue();
        }
      }
    }
  }

  private handleClose(reason?: string): void {
    this.cfg.logger?.warn?.(`[cli-sync] disconnected: ${reason ?? 'unknown'}`);
    this.stopHeartbeat();
    this.hooks.onDisconnect?.(reason);
    for (const [id, resolver] of this.inFlight) {
      resolver({ id, kind: 'error', message: 'connection closed' });
    }
    this.inFlight.clear();
  }

  private startHeartbeat(): void {
    const hb = this.cfg.scheduler?.heartbeatMs ?? 15_000;
    if (hb <= 0) return;
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.transport.isOpen()) {
        void this.transport.send({ type: 'ping', t: Date.now() }).catch(() => {/* ignore */});
      }
    }, hb);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as any);
      this.heartbeatTimer = undefined;
    }
  }

  /** Register resolver that streams events for a command id */
  registerStream(id: string, push: (evt: CommandEvent) => void): void {
    this.inFlight.set(id, push);
  }

  /** Disconnect transport */
  async disconnect(): Promise<void> {
    await this.transport.close();
  }

  /** Transport selection logic; implementations are stubbed for browser safety */
  private async selectTransport(ep: EndpointConfig): Promise<Transport> {
    const preferred = ep.transport ?? 'auto';

    const candidates: TransportKind[] = preferred === 'auto'
      ? ['webtransport', 'websocket', 'tcp']
      : [preferred];

    for (const kind of candidates) {
      try {
        if (kind === 'websocket' && ep.wsUrl) return this.createWebSocketTransport(ep);
        if (kind === 'webtransport' && ep.wtUrl) return this.createWebTransport(ep);
        if (kind === 'tcp' && ep.host && typeof Deno !== 'undefined') return this.createTcpTransport(ep);
      } catch (err) {
        this.cfg.logger?.warn?.(`[cli-sync] transport ${kind} init failed: ${err}`);
        continue;
      }
    }
    throw new Error('No viable transport could be initialized');
  }

  private createWebSocketTransport(ep: EndpointConfig): Transport {
    let ws: WebSocket | undefined;
    let open = false;
    let msgHandler: ((msg: unknown) => void) | undefined;
    let closeHandler: ((reason?: string) => void) | undefined;

    return {
      kind: 'websocket',
      async connect() {
        return new Promise<void>((resolve, reject) => {
          ws = new WebSocket(ep.wsUrl!);
          ws.binaryType = 'arraybuffer';
          const to = setTimeout(() => reject(new Error('WS connect timeout')), ep.timeoutMs ?? 10_000);
          ws!.onopen = () => { open = true; clearTimeout(to); resolve(); };
          ws!.onmessage = (ev) => {
            let payload: unknown = ev.data;
            try { if (typeof ev.data === 'string') payload = JSON.parse(ev.data); } catch { /* ignore */ }
            msgHandler?.(payload);
          };
          ws!.onclose = (ev) => { open = false; closeHandler?.(ev.reason || 'closed'); };
          ws!.onerror = () => { /* usually followed by close */ };
        });
      },
      async send(msg: unknown) {
        if (!open || !ws) throw new Error('WS not open');
        const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
        ws.send(data);
      },
      onMessage(handler) { msgHandler = handler; },
      onClose(handler) { closeHandler = handler; },
      async close() { try { ws?.close(); } finally { open = false; } },
      isOpen() { return open; },
    };
  }

  private createWebTransport(ep: EndpointConfig): Transport {
    const hasWT = typeof (globalThis as any).WebTransport !== 'undefined';
    if (!hasWT) throw new Error('WebTransport not available');

    let wt: any; let open = false;
    let msgHandler: ((msg: unknown) => void) | undefined;
    let closeHandler: ((reason?: string) => void) | undefined;

    return {
      kind: 'webtransport',
      async connect() {
        wt = new (globalThis as any).WebTransport(ep.wtUrl!);
        await wt.ready; open = true;
        const bidi = await wt.createBidirectionalStream();
        const writer = bidi.writable.getWriter();
        const reader = bidi.readable.getReader();
        (this as any)._writer = writer;
        (async () => {
          const decoder = new TextDecoder();
          while (open) {
            const { done, value } = await reader.read();
            if (done) break;
            try { msgHandler?.(JSON.parse(decoder.decode(value))); } catch { /* ignore */ }
          }
        })().catch(() => {/* ignore */});
      },
      async send(msg: unknown) {
        if (!open || !(this as any)._writer) throw new Error('WT not open');
        const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
        const encoder = new TextEncoder();
        await (this as any)._writer.write(encoder.encode(data));
      },
      onMessage(handler) { msgHandler = handler; },
      onClose(handler) { closeHandler = handler; },
      async close() { open = false; try { await wt?.close?.(); } catch { /* ignore */ } },
      isOpen() { return open; },
    };
  }

  private createTcpTransport(ep: EndpointConfig): Transport {
    if (typeof Deno === 'undefined') throw new Error('Deno TCP not available');
    let conn: any; let open = false;
    let msgHandler: ((msg: unknown) => void) | undefined;
    let closeHandler: ((reason?: string) => void) | undefined;
    return {
      kind: 'tcp',
      async connect() {
        conn = await (Deno as any).connect({ hostname: ep.host!, port: ep.port! });
        open = true;
        (async () => {
          const decoder = new TextDecoder();
          const reader = (conn.readable as ReadableStream<Uint8Array>).getReader();
          while (open) {
            const { done, value } = await reader.read();
            if (done) break;
            try { msgHandler?.(JSON.parse(decoder.decode(value))); } catch { /* ignore */ }
          }
        })().catch(() => {/* ignore */});
      },
      async send(msg: unknown) {
        if (!open) throw new Error('TCP not open');
        const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
        const encoder = new TextEncoder();
        await conn.write(encoder.encode(data));
      },
      onMessage(handler) { msgHandler = handler; },
      onClose(handler) { closeHandler = handler; },
      async close() { open = false; try { conn?.close?.(); } catch { /* ignore */ } },
      isOpen() { return open; },
    };
  }
}

//#endregion

//#region Public API

/**
 * Connect to the local CLI using the provided configuration.
 *
 * Behavior:
 * - Attempts connection using configured transport (or auto probe).
 * - Sets up heartbeat and message routing.
 * - Returns once the connection is established or throws on failure.
 */
export async function connectToCLI(config: SyncConfig): Promise<void> {
  const mgr = new CLISyncManager(config);
  await mgr.connect();
}

/**
 * Execute a command and stream results as an async iterator of CommandEvent.
 *
