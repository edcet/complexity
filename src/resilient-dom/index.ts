/**
 * resilient-dom: Adaptive DOM observation, fallback selection, and health monitoring
 *
 * This module provides:
 * 1) DOMObserver - wraps MutationObserver with polling backup and event emitters
 * 2) FallbackSelectorEngine - fuzzy intent matching across multiple selector strategies
 * 3) HealthMonitor - periodically audits selectors and triggers recovery workflows
 * 4) Types, doc comments, and usage hooks. Includes TODOs/stubs for recovery strategies.
 */

// ---------- Types & Interfaces ----------
export type SelectorKind =
  | 'css'
  | 'xpath'
  | 'text'
  | 'role'
  | 'data-attr'
  | 'id'
  | 'nth'
  | 'semantic';

export interface SelectorHint {
  kind: SelectorKind;
  value: string;
  weight?: number; // optional weight for intent matching
  context?: Element | Document; // optional scoping root
}

export interface TrackedTarget {
  id: string; // stable id for tracking
  hints: SelectorHint[]; // candidate selectors/hints
  lastKnown?: Element | null; // cached element reference
  metadata?: Record<string, unknown>;
}

export interface DOMObserverEvents {
  connected: { target: TrackedTarget };
  disconnected: { target: TrackedTarget };
  mutation: { records: MutationRecord[] };
  recovered: { target: TrackedTarget; element: Element | null; strategy: string };
  error: { error: unknown };
}

export type DOMObserverListener<K extends keyof DOMObserverEvents> = (
  payload: DOMObserverEvents[K]
) => void;

export interface DOMObserverOptions {
  pollIntervalMs?: number; // backup polling interval (default 1000)
  observeInit?: MutationObserverInit; // mutation observer options
}

export interface RecoveryResult {
  element: Element | null;
  strategy: string;
  score: number;
}

// ---------- Minimal Event Emitter ----------
class Emitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, cb: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.off(event, cb);
  }

  off(event: string, cb: Function) {
    this.listeners.get(event)?.delete(cb);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(...args);
      } catch (err) {
        // Swallow to avoid breaking event loop; higher-level error events are emitted elsewhere
        console.error('[resilient-dom] emitter listener error', err);
      }
    });
  }
}

// ---------- FallbackSelectorEngine ----------
export class FallbackSelectorEngine {
  /**
   * Attempt to locate an element using a prioritized list of selector hints.
   * Applies fuzzy intent matching and returns the best scored match.
   */
  find(hints: SelectorHint[], root: Document | Element = document): RecoveryResult {
    const ordered = [...hints].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));

    // Aggregate candidates across strategies with scoring
    let best: RecoveryResult = { element: null, strategy: 'none', score: 0 };

    for (const hint of ordered) {
      const scope = (hint.context as Element) || root;
      let candidate: Element | null = null;
      let score = 0;

      switch (hint.kind) {
        case 'css':
          candidate = (scope as Element | Document).querySelector?.(hint.value) ?? null;
          score = candidate ? 1.0 * (hint.weight ?? 1) : 0;
          break;
        case 'id': {
          const el = (scope as Document | Element).querySelector?.(`#${CSS.escape(hint.value)}`) ?? null;
          candidate = el;
          score = el ? 0.95 * (hint.weight ?? 1) : 0;
          break;
        }
        case 'data-attr': {
          const [name, val] = hint.value.includes('=') ? hint.value.split('=') : [hint.value, ''];
          const selector = val ? `[data-${name}="${CSS.escape(val)}"]` : `[data-${name}]`;
          candidate = (scope as Document | Element).querySelector?.(selector) ?? null;
          score = candidate ? 0.9 * (hint.weight ?? 1) : 0;
          break;
        }
        case 'text': {
          candidate = this.findByText(String(hint.value), scope);
          score = candidate ? 0.85 * (hint.weight ?? 1) : 0;
          break;
        }
        case 'role': {
          candidate = this.findByRole(String(hint.value), scope);
          score = candidate ? 0.8 * (hint.weight ?? 1) : 0;
          break;
        }
        case 'xpath': {
          try {
            const result = document.evaluate(String(hint.value), scope, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            candidate = (result.singleNodeValue as Element) ?? null;
            score = candidate ? 0.75 * (hint.weight ?? 1) : 0;
          } catch {
            candidate = null;
          }
          break;
        }
        case 'nth': {
          const n = Number(hint.value);
          if (!Number.isNaN(n)) {
            const all = (scope as Element | Document).querySelectorAll('*');
            candidate = all.item(Math.max(0, Math.min(all.length - 1, n)));
            score = candidate ? 0.5 * (hint.weight ?? 1) : 0;
          }
          break;
        }
        case 'semantic': {
          candidate = this.findSemantically(hint.value, scope);
          score = candidate ? 0.65 * (hint.weight ?? 1) : 0;
          break;
        }
        default:
          break;
      }

      if (candidate && score > best.score) {
        best = { element: candidate, strategy: hint.kind, score };
      }
    }

    return best;
  }

  // Rough text matcher (visible text preference)
  private findByText(text: string, root: Document | Element = document): Element | null {
    const normalized = text.trim().toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const el = node as Element;
        const visible = (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0;
        const t = (el.textContent ?? '').trim().toLowerCase();
        if (!t) return NodeFilter.FILTER_SKIP;
        if (visible && (t === normalized || t.includes(normalized))) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    let current: Node | null = walker.currentNode;
    while (current) {
      if (walker.filter?.acceptNode(current) === NodeFilter.FILTER_ACCEPT) return current as Element;
      current = walker.nextNode();
    }
    return null;
  }

  // ARIA role based finder (very rough)
  private findByRole(role: string, root: Document | Element = document): Element | null {
    return (root as Element | Document).querySelector?.(`[role="${CSS.escape(role)}"]`) ?? null;
  }

  // Semantic/fuzzy intent finder: labels, title, aria-label, placeholder
  private findSemantically(intent: string, root: Document | Element = document): Element | null {
    const q = intent.trim().toLowerCase();
    const candidates = (root as Element | Document).querySelectorAll?.('*') ?? [];
    let best: { el: Element | null; score: number } = { el: null, score: 0 };
    candidates.forEach((el) => {
      const attrs = [
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        (el as HTMLInputElement).placeholder,
        el.id,
        el.className,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());

      const text = (el.textContent ?? '').toLowerCase();
      let score = 0;
      if (text.includes(q)) score += 0.6;
      attrs.forEach((a) => {
        if (a.includes(q)) score += 0.2;
      });
      if (score > best.score) best = { el, score };
    });
    return best.el;
  }
}

// ---------- DOMObserver ----------
export class DOMObserver {
  private emitter = new Emitter();
  private mo: MutationObserver | null = null;
  private pollTimer: number | null = null;
  private engine = new FallbackSelectorEngine();
  private targets = new Map<string, TrackedTarget>();

  constructor(private options: DOMObserverOptions = {}) {}

  start() {
    const { observeInit, pollIntervalMs = 1000 } = this.options;

    // MutationObserver as primary signal
    try {
      this.mo = new MutationObserver((records) => {
        this.emitter.emit('mutation', { records });
        // Simple heuristic: on any mutation, revalidate known targets
        this.revalidateAll();
      });
      this.mo.observe(document, observeInit ?? { subtree: true, childList: true, attributes: true });
    } catch (err) {
      console.warn('[resilient-dom] MutationObserver unavailable', err);
      this.mo = null;
    }

    // Polling backup
    if (pollIntervalMs > 0) {
      // Using window.setInterval signature to keep type narrow
      this.pollTimer = window.setInterval(() => {
        this.revalidateAll();
      }, pollIntervalMs) as unknown as number;
    }
  }

  stop() {
    this.mo?.disconnect();
    this.mo = null;
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer as unknown as number);
      this.pollTimer = null;
    }
  }

  on<K extends keyof DOMObserverEvents>(event: K, cb: DOMObserverListener<K>) {
    return this.emitter.on(String(event), cb);
  }

  track(target: TrackedTarget) {
    this.targets.set(target.id, target);
    this.revalidate(target.id);
  }

  untrack(id: string) {
    this.targets.delete(id);
  }

  getTarget(id: string): TrackedTarget | undefined {
    return this.targets.get(id);
  }

  private revalidateAll() {
    this.targets.forEach((_, id) => this.revalidate(id));
  }

  private revalidate(id: string) {
    const target = this.targets.get(id);
    if (!target) return;

    let element: Element | null = null;
    let strategy = 'none';
    try {
      const result = this.engine.find(target.hints, document);
      element = result.element;
      strategy = result.strategy;

      if (element) {
        if (target.lastKnown !== element) {
          target.lastKnown = element;
          this.emitter.emit('connected', { target });
        }
      } else if (target.lastKnown) {
        target.lastKnown = null;
        this.emitter.emit('disconnected', { target });
      }

      this.emitter.emit('recovered', { target, element, strategy });
    } catch (error) {
      this.emitter.emit('error', { error });
    }
  }
}

// ---------- HealthMonitor ----------
export interface HealthMonitorOptions {
  intervalMs?: number; // default 5000
  maxRecoveryAttempts?: number; // default 3
}

export class HealthMonitor {
  private timer: number | null = null;
  private attempts = new Map<string, number>();

  constructor(private dom: DOMObserver, private opts: HealthMonitorOptions = {}) {}

  start() {
    const { intervalMs = 5000 } = this.opts;
    this.stop();
    this.timer = window.setInterval(() => this.audit(), intervalMs) as unknown as number;
  }

  stop() {
    if (this.timer) {
      window.clearInterval(this.timer as unknown as number);
      this.timer = null;
    }
  }

  private audit() {
    // Find targets that are currently unresolved
    this.dom['targets'].forEach((t: TrackedTarget) => {
      const el = t.lastKnown ?? null;
      if (el && document.contains(el)) return; // looks healthy

      const count = (this.attempts.get(t.id) ?? 0) + 1;
      this.attempts.set(t.id, count);

      const limit = this.opts.maxRecoveryAttempts ?? 3;
      if (count > limit) return;

      // TODO: invoke stronger recovery strategies when simple find fails
      // - Expand search scope (include shadow roots)
      // - Relax matching thresholds
      // - Leverage historical DOM paths or siblings
      // - Surface telemetry hooks
      this.dom['revalidate'](t.id);
    });
  }
}

// ---------- Usage Hooks / Facade ----------
export function createResilientTarget(
  id: string,
  hints: SelectorHint[],
  metadata?: Record<string, unknown>
): TrackedTarget {
  return { id, hints, metadata, lastKnown: null };
}

export function useResilientDOM(options?: DOMObserverOptions) {
  const dom = new DOMObserver(options);
  const health = new HealthMonitor(dom);
  return { dom, health };
}

// ---------- TODOs and Recovery Strategy Stubs ----------
/**
 * TODO: Implement advanced recovery strategies
 * - Shadow DOM traversal: walk shadowRoot trees
 * - CSS similarity: compute selector distance and retry variants
 * - Layout-based heuristics: relative positions, sibling/ancestor fingerprints
 * - Persisted fingerprints: element signatures (tag, attrs, role, text)
 */
export const RecoveryStrategies = {
  // Shadow DOM traversal stub
  shadowSearch(_hints: SelectorHint[], _root: Document | Element = document): RecoveryResult {
    // TODO: breadth-first traverse shadow roots and attempt matches
    return { element: null, strategy: 'shadow', score: 0 };
  },
  // Similarity matching stub
  similarCSS(_selector: string, _root: Document | Element = document): RecoveryResult {
    // TODO: generate relaxed variants, e.g., drop class tokens, wildcard segments
    return { element: null, strategy: 'similar-css', score: 0 };
  },
};

// ---------- Module Exports ----------
export type { TrackedTarget as ResilientElementTarget };
