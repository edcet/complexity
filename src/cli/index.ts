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
  transport?: TransportKind;
  wsUrl?: string;
  wtUrl?: string;
  host?: string;
  port?: number;
  path?: string;
  timeoutMs?: number;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitter?: boolean;
  };
}

export interface AuthConfig {
  token?: string;
  clientCertPem?: string;
  headers?: Record<string, string>;
}

export interface FilterRule {
  pattern: string;
  include?: boolean;
  kinds?: Array<'fs' | 'proc' | 'telemetry' | 'custom'>;
}

export interface SchedulerConfig {
  maxInFlight?: number;
  maxQueue?: number;
  heartbeatMs?: number;
  idleTimeoutMs?: number;
}

export interface SyncConfig {
  endpoints: EndpointConfig;
  auth?: AuthConfig;
  filters?: FilterRule[];
  scheduler?: SchedulerConfig;
  features?: {
    enableFileWatch?: boolean;
    enableTelemetry?: boolean;
    preferBinaryFrames?: boolean;
  };
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

export type CommandEventKind = 'output' | 'error' | 'done';
export interface CommandEvent<T = unknown> {
  kind: CommandEventKind;
  data?: T;
  message?: string;
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
  onMessage: (handler: (msg: unknown) => void) => void;
  onClose: (handler: (reason?: string) => void) => void;
  close: () => Promise<void>;
  isOpen: () => boolean;
}

class NullTransport implements Transport {
  readonly kind: TransportKind = 'auto';
  private open = false;
  async connect(): Promise<void> { this.open = true; }
  async send(): Promise<void> { throw new Error('Transport not connected'); }
  onMessage(): void { /* noop */ }
  onClose(): void { /* noop */ }
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

  public hooks: {
    onConnect?: () => void;
    onDisconnect?: (reason?: string) => void;
    onMessage?: (raw: unknown) => void;
    onFileEvent?: (path: string, kind: 'create' | 'update' | 'delete') => void;
    onTelemetry?: (data: Record<string, unknown>) => void;
  } = {};

  constructor(cfg: SyncConfig) { this.cfg = cfg; }

  async connect(): Promise<void> {
    const transport = await this.selectTransport(this.cfg.endpoints);
    this.transport = transport;
    this.transport.onMessage((msg) => this.handleMessage(msg));
    this.transport.onClose((reason) => this.handleClose(reason));
    await this.transport.connect();
    this.cfg.logger?.info?.(`[cli-sync] connected via ${this.transport.kind}`);
    this.hooks.onConnect?.();
    this.startHeartbeat();
    this.flushQueue();
  }

  async send(msg: unknown): Promise<void> {
    if (!this.transport.isOpen()) throw new Error('Transport is not open');
    await this.transport.send(msg);
  }

  enqueue(cmd: CommandRequest): void {
    const maxQueue = this.cfg.scheduler?.maxQueue ?? 1024;
    if (this.queue.length >= maxQueue) throw new Error('Command queue capacity exceeded');
    this.queue.push(cmd);
    this.flushQueue();
  }

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
    const hb = this.cfg.scheduler?.heartbeatMs ?? 15000;
    if (hb <= 0) return;
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.transport.isOpen()) {
        void this.transport.send({ type: 'ping', t: Date.now() }).catch(() => {});
      }
    }, hb);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as any);
      this.heartbeatTimer = undefined;
    }
  }

  registerStream(id: string, push: (evt: CommandEvent) => void): void {
    this.inFlight.set(id, push);
  }

  async disconnect(): Promise<void> { await this.transport.close(); }

  private async selectTransport(ep: EndpointConfig): Promise<Transport> {
    const preferred = ep.transport ?? 'auto';
    const candidates: TransportKind[] = preferred === 'auto' ? ['webtransport', 'websocket', 'tcp'] : [preferred];
    for (const kind of candidates) {
      try {
        if (kind === 'websocket' && ep.wsUrl) return this.createWebSocketTransport(ep);
        if (kind === 'webtransport' && ep.wtUrl) return this.createWebTransport(ep);
        if (kind === 'tcp' && ep.host && typeof Deno !== 'undefined') return this.createTcpTransport(ep);
      } catch (err) {
        this.cfg.logger?.warn?.(`[cli-sync] transport ${kind} init failed: ${err}`);
      }
    }
    throw new Error('No viable transport could be initialized');
  }

  private createWebSocketTransport(ep: EndpointConfig): Transport {
    let ws: WebSocket | undefined; let open = false;
    let msgHandler: ((msg: unknown) => void) | undefined;
    let closeHandler: ((reason?: string) => void) | undefined;
    return {
      kind: 'websocket',
      async connect() {
        return new Promise<void>((resolve, reject) => {
          ws = new WebSocket(ep.wsUrl!);
          ws.binaryType = 'arraybuffer';
          const to = setTimeout(() => reject(new Error('WS connect timeout')), ep.timeoutMs ?? 10000);
          ws!.onopen = () => { open = true; clearTimeout(to); resolve(); };
          ws!.onmessage = (ev) => {
            let payload: unknown = ev.data;
            try { if (typeof ev.data === 'string') payload = JSON.parse(ev.data); } catch { }
            msgHandler?.(payload);
          };
          ws!.onclose = (ev) => { open = false; closeHandler?.(ev.reason || 'closed'); };
          ws!.onerror = () => {};
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
            try { msgHandler?.(JSON.parse(decoder.decode(value))); } catch { }
          }
        })().catch(() => {});
      },
      async send(msg: unknown) {
        if (!open || !(this as any)._writer) throw new Error('WT not open');
        const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
        const encoder = new TextEncoder();
        await (this as any)._writer.write(encoder.encode(data));
      },
      onMessage(handler) { msgHandler = handler; },
      onClose(handler) { closeHandler = handler; },
      async close() { open = false; try { await wt?.close?.(); } catch { } },
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
            try { msgHandler?.(JSON.parse(decoder.decode(value))); } catch { }
          }
        })().catch(() => {});
      },
      async send(msg: unknown) {
        if (!open) throw new Error('TCP not open');
        const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
        const encoder = new TextEncoder();
        await conn.write(encoder.encode(data));
      },
      onMessage(handler) { msgHandler = handler; },
      onClose(handler) { closeHandler = handler; },
      async close() { open = false; try { conn?.close?.(); } catch { } },
      isOpen() { return open; },
    };
  }
}

//#endregion

//#region Public API

export async function connectToCLI(config: SyncConfig): Promise<void> {
  const mgr = new CLISyncManager(config);
  await mgr.connect();
}

/**
 * Execute a command and stream results as an async iterator of CommandEvent.
 * Emits: output, error, done. Iterator completes on done or first terminal error.
 */
export function executeCommand(
  manager: CLISyncManager,
  command: string,
  args: string[] = [],
  payload?: unknown,
): AsyncIterable<CommandEvent> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const req: CommandRequest = { id, command, args, payload };

  return {
    [Symbol.asyncIterator]() {
      let queue: CommandEvent[] = [];
      let pendingResolve: ((value: IteratorResult<CommandEvent>) => void) | null = null;
      let done = false;

      const push = (evt: CommandEvent) => {
        queue.push(evt);
        if (evt.kind === 'done' || evt.kind === 'error') {
          // terminal event, mark done after pushing through consumer
          if (evt.kind === 'done') done = true;
        }
        if (pendingResolve) {
          const r = queue.shift()!;
          const resolve = pendingResolve; pendingResolve = null;
          resolve({ value: r, done: false });
        }
      };

      // Register stream resolver before enqueueing to avoid race
      manager.registerStream(id, push);
      manager.enqueue(req);

      return {
        async next(): Promise<IteratorResult<CommandEvent>> {
          if (queue.length > 0) {
            const value = queue.shift()!;
            if (value.kind === 'done') return { value, done: true };
            if (value.kind === 'error') return { value, done: true };
            return { value, done: false };
          }
          if (done) return { value: undefined as any, done: true };
          return new Promise<IteratorResult<CommandEvent>>((resolve) => {
            pendingResolve = resolve;
          });
        },
        async return() {
          done = true;
          return { value: undefined as any, done: true };
        },
        async throw(err?: any) {
          done = true;
          return { value: { id, kind: 'error', message: String(err) }, done: true } as any;
        },
      };
    },
  };
}

//#endregion
