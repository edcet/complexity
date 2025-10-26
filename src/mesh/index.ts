/*
  Homelab Mesh Module
  Scaffold for mesh agent, pub/sub service directory, gossip engine, traffic proxy, and config hooks.
  NOTE: This is a non-networking stub suitable for extension and browser visibility.
  TODO: Wire up real Tailscale/Yjs/WebRTC discovery, NAT traversal, and transport security.
*/

// Types and Interfaces
export type MeshRole = 'controller' | 'worker' | 'gateway' | 'observer'

export interface MeshIdentity {
  id: string
  name?: string
  roles: MeshRole[]
  zone?: string
}

export interface MeshConfig {
  identity: MeshIdentity
  // Discovery strategies to attempt in order of preference
  discoveryOrder?: Array<'tailscale' | 'yjs' | 'webrtc' | 'mdns' | 'manual'>
  autoJoin?: boolean
  gossipIntervalMs?: number
  heartbeatIntervalMs?: number
  // Role-based feature flags or configuration knobs
  features?: Record<string, unknown>
}

export interface PeerInfo extends MeshIdentity {
  lastSeen: number
  status: 'online' | 'offline' | 'joining' | 'unknown'
  addresses?: string[]
  meta?: Record<string, unknown>
}

export interface ServiceAnnouncement {
  serviceId: string
  ownerId: string
  kind: 'http' | 'rpc' | 'queue' | 'custom'
  endpoint?: string
  version?: string
  status: 'healthy' | 'degraded' | 'down' | 'initializing'
  tags?: string[]
  meta?: Record<string, unknown>
  updatedAt: number
}

export interface MeshEvent<T = any> {
  type: string
  payload: T
  originId: string
  ts: number
}

export interface GossipMessage<T = any> {
  id: string
  topic: string
  data: T
  originId: string
  ts: number
}

// Simple Event Emitter (no external deps)
class Emitter<T extends Record<string, any[]>> {
  private listeners = new Map<keyof T, Set<(...args: any[]) => void>>()
  on<K extends keyof T>(event: K, fn: (...args: T[K]) => void) {
    if (!this.listeners.get(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(fn as any)
    return () => this.off(event, fn)
  }
  off<K extends keyof T>(event: K, fn: (...args: T[K]) => void) {
    this.listeners.get(event)?.delete(fn as any)
  }
  emit<K extends keyof T>(event: K, ...args: T[K]) {
    this.listeners.get(event)?.forEach((fn) => fn(...(args as any)))
  }
}

// ServiceDirectory with pub/sub and real-time status
export class ServiceDirectory {
  private services = new Map<string, ServiceAnnouncement>()
  private emitter = new Emitter<{ 'service:update': [ServiceAnnouncement]; 'service:remove': [string] }>()

  upsert(announcement: ServiceAnnouncement) {
    this.services.set(announcement.serviceId, { ...announcement, updatedAt: Date.now() })
    this.emitter.emit('service:update', announcement)
  }

  remove(serviceId: string) {
    this.services.delete(serviceId)
    this.emitter.emit('service:remove', serviceId)
  }

  get(serviceId: string) {
    return this.services.get(serviceId)
  }

  list(filter?: Partial<Pick<ServiceAnnouncement, 'kind' | 'status' | 'tags'>>) {
    let items = Array.from(this.services.values())
    if (filter?.kind) items = items.filter((s) => s.kind === filter.kind)
    if (filter?.status) items = items.filter((s) => s.status === filter.status)
    if (filter?.tags?.length) items = items.filter((s) => s.tags?.some((t) => filter.tags!.includes(t)))
    return items
  }

  onUpdate(fn: (svc: ServiceAnnouncement) => void) {
    return this.emitter.on('service:update', fn)
  }

  onRemove(fn: (serviceId: string) => void) {
    return this.emitter.on('service:remove', fn)
  }
}

// GossipEngine for distributed updates (in-memory fanout stub)
export class GossipEngine {
  private peers = new Map<string, PeerInfo>()
  private topics = new Map<string, Set<(msg: GossipMessage<any>) => void>>()
  private seen = new Set<string>() // dedupe

  constructor(private readonly selfId: string) {}

  join(peer: PeerInfo) {
    this.peers.set(peer.id, { ...peer, lastSeen: Date.now() })
  }

  leave(peerId: string) {
    this.peers.delete(peerId)
  }

  subscribe<T>(topic: string, fn: (msg: GossipMessage<T>) => void) {
    if (!this.topics.get(topic)) this.topics.set(topic, new Set())
    this.topics.get(topic)!.add(fn as any)
    return () => this.topics.get(topic)?.delete(fn as any)
  }

  publish<T>(topic: string, data: T, originId = this.selfId) {
    const msg: GossipMessage<T> = { id: `${originId}:${topic}:${Date.now()}:${Math.random()}`,
      topic, data, originId, ts: Date.now() }
    if (this.seen.has(msg.id)) return
    this.seen.add(msg.id)
    // local fanout
    this.topics.get(topic)?.forEach((fn) => fn(msg as any))
    // TODO: network fanout via transport layer (WebRTC/DataChannel, WebSocket, Yjs awareness)
  }
}

// TrafficProxy stub for routing and load balancing
export interface RouteDecision {
  targetServiceId: string
  chosenEndpoint?: string
  policy: 'round-robin' | 'least-connections' | 'random' | 'sticky'
}

export class TrafficProxy {
  private rrIndex = new Map<string, number>()
  constructor(private readonly directory: ServiceDirectory) {}

  decide(serviceKindOrId: string, policy: RouteDecision['policy'] = 'round-robin'): RouteDecision | undefined {
    const direct = this.directory.get(serviceKindOrId)
    if (direct && direct.status === 'healthy') {
      return { targetServiceId: direct.serviceId, chosenEndpoint: direct.endpoint, policy }
    }
    const candidates = this.directory.list({}).filter((s) => s.kind === (direct?.kind ?? serviceKindOrId) && s.status === 'healthy')
    if (!candidates.length) return undefined

    switch (policy) {
      case 'random': {
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        return { targetServiceId: pick.serviceId, chosenEndpoint: pick.endpoint, policy }
      }
      case 'least-connections':
        // TODO: integrate live metrics. Fallback to round-robin for now.
      case 'round-robin': {
        const key = serviceKindOrId
        const idx = (this.rrIndex.get(key) ?? 0) % candidates.length
        this.rrIndex.set(key, idx + 1)
        const pick = candidates[idx]
        return { targetServiceId: pick.serviceId, chosenEndpoint: pick.endpoint, policy: policy === 'least-connections' ? 'least-connections' : 'round-robin' }
      }
      case 'sticky': {
        const key = `${serviceKindOrId}`
        const hash = Math.abs(this.hashCode(key))
        const pick = candidates[hash % candidates.length]
        return { targetServiceId: pick.serviceId, chosenEndpoint: pick.endpoint, policy }
      }
    }
  }

  private hashCode(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
    return h
  }
}

// MeshAgent with discovery stubs, auto-join, and failover
export class MeshAgent {
  readonly config: MeshConfig
  readonly directory = new ServiceDirectory()
  readonly gossip: GossipEngine
  readonly peers = new Map<string, PeerInfo>()
  readonly events = new Emitter<{ 'peer:update': [PeerInfo]; 'peer:remove': [string]; 'mesh:event': [MeshEvent<any>] }>()

  private heartbeatTimer?: any
  private gossipTimer?: any

  constructor(config: MeshConfig) {
    this.config = {
      discoveryOrder: ['tailscale', 'yjs', 'webrtc', 'mdns', 'manual'],
      autoJoin: true,
      gossipIntervalMs: 1500,
      heartbeatIntervalMs: 5000,
      ...config,
    }
    this.gossip = new GossipEngine(this.config.identity.id)
  }

  // Attempt discovery in order; on failure, fall through (failover)
  async start() {
    if (this.config.autoJoin) await this.join()
    this.startHeartbeat()
    this.startGossip()
  }

  async join() {
    const order = this.config.discoveryOrder ?? []
    for (const strategy of order) {
      const ok = await this.tryDiscovery(strategy).catch(() => false)
      if (ok) return true
    }
    // Always include a noop manual registration as final fallback
    this.registerSelf()
    return false
  }

  private async tryDiscovery(strategy: MeshConfig['discoveryOrder'][number]): Promise<boolean> {
    switch (strategy) {
      case 'tailscale':
        // TODO: integrate Tailscale local API or tailnet coordination (requires backend/agent)
        return false
      case 'yjs':
        // TODO: use Yjs awareness to gossip presence in a shared doc room
        return false
      case 'webrtc':
        // TODO: bootstrap WebRTC peers via signaling server, then data channels for gossip
        return false
      case 'mdns':
        // TODO: mdns discovery for LAN peers (Node environment)
        return false
      case 'manual':
        // manual fallback: no discovery, but keep self registered
        this.registerSelf()
        return true
    }
  }

  private registerSelf() {
    const self: PeerInfo = {
      ...this.config.identity,
      lastSeen: Date.now(),
      status: 'online',
      meta: { features: this.config.features ?? {} },
    }
    this.peers.set(self.id, self)
    this.gossip.join(self)
    this.events.emit('peer:update', self)
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      // mark stale peers offline
      for (const [id, p] of this.peers) {
        if (id === this.config.identity.id) continue
        if (now - p.lastSeen > (this.config.heartbeatIntervalMs ?? 5000) * 3) {
          p.status = 'offline'
          this.events.emit('peer:update', { ...p })
        }
      }
      // update self lastSeen
      const self = this.peers.get(this.config.identity.id)
      if (self) {
        self.lastSeen = now
        self.status = 'online'
        this.events.emit('peer:update', { ...self })
      }
      // TODO: send heartbeat over transport when available
    }, this.config.heartbeatIntervalMs)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
  }

  startGossip() {
    this.stopGossip()
    this.gossipTimer = setInterval(() => {
      // example gossip of service directory snapshot hash or changeset
      const snapshot = this.directory.list()
      this.gossip.publish('services/snapshot', { count: snapshot.length })
    }, this.config.gossipIntervalMs)
  }

  stopGossip() {
    if (this.gossipTimer) clearInterval(this.gossipTimer)
  }

  addPeer(peer: PeerInfo) {
    this.peers.set(peer.id, { ...peer, lastSeen: Date.now() })
    this.gossip.join(peer)
    this.events.emit('peer:update', peer)
  }

  removePeer(peerId: string) {
    this.peers.delete(peerId)
    this.gossip.leave(peerId)
    this.events.emit('peer:remove', peerId)
  }

  publish<T>(type: string, payload: T) {
    const ev: MeshEvent<T> = { type, payload, originId: this.config.identity.id, ts: Date.now() }
    // local delivery
    this.events.emit('mesh:event', ev)
    // distributed delivery (stub)
    this.gossip.publish(`events/${type}`, ev)
  }
}

// Hooks and config patterns for role assignment
export function createMeshConfig(partial: Partial<MeshConfig> & { identity: MeshIdentity }): MeshConfig {
  return {
    discoveryOrder: ['tailscale', 'yjs', 'webrtc', 'mdns', 'manual'],
    autoJoin: true,
    gossipIntervalMs: 1500,
    heartbeatIntervalMs: 5000,
    features: {},
    ...partial,
  }
}

export function assignRoles(identity: MeshIdentity, roles: MeshRole[]): MeshIdentity {
  return { ...identity, roles: Array.from(new Set([...(identity.roles ?? []), ...roles])) }
}

export function useMeshInExtensionBrowser(agent: MeshAgent) {
  // Minimal visibility hook for extension/browser context (no privileged networking)
  ;(globalThis as any).__HOMELAB_MESH__ = {
    id: agent.config.identity.id,
    roles: agent.config.identity.roles,
    listServices: () => agent.directory.list(),
    listPeers: () => Array.from(agent.peers.values()),
  }
}

// High-level helpers required by earlier stub API surface
export interface MeshNode extends PeerInfo {}

export class HomelabMeshManager {
  agent: MeshAgent
  proxy: TrafficProxy
  constructor(config: MeshConfig) {
    this.agent = new MeshAgent(config)
    this.proxy = new TrafficProxy(this.agent.directory)
  }
}

export async function joinMesh(config?: any): Promise<MeshNode> {
  const identity: MeshIdentity = {
    id: config?.identity?.id ?? `node-${Math.random().toString(36).slice(2, 8)}`,
    name: config?.identity?.name ?? 'homelab-node',
    roles: config?.identity?.roles ?? ['worker'],
    zone: config?.identity?.zone,
  }
  const agent = new MeshAgent(createMeshConfig({ ...(config ?? {}), identity }))
  await agent.start()
  useMeshInExtensionBrowser(agent)
  return { ...(agent.peers.get(identity.id) as PeerInfo) }
}

export async function broadcastToMesh(message: any): Promise<void> {
  // Deliver as generic event over gossip stub
  const origin = (globalThis as any).__HOMELAB_MESH__?.id ?? 'anonymous'
  const agent = (globalThis as any).__HOMELAB_AGENT__ as MeshAgent | undefined
  if (agent) {
    agent.publish('broadcast', { message })
  } else {
    // local fallback using ephemeral engine
    const engine = new GossipEngine(origin)
    engine.publish('events/broadcast', { message, origin })
  }
}

/*
  TODOs for external wire-up and advanced discovery:
  - integrate Tailscale coordination or Local API for peer enumeration and ACL-aware endpoints
  - add Yjs awareness provider to share presence and replicate service directory state
  - add WebRTC signaling and DataChannel transport for browser-compatible mesh traffic
  - support mDNS on Node for LAN auto-discovery; DHT for WAN bootstrap
  - plug in cryptographic identity and signed announcements (noise/tls/age)
  - metrics: track least-connections, latency, and success rate for proxy policies
  - persistence: store peer/service snapshots to recover after restarts
*/
