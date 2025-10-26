<div align="center">
  <img src="branding/logo.svg" alt="Complexity Logo" width="120" height="120" />
</div>

<div align="center">

# Complexity
⚡ Supercharge your favourite AI Chat web apps

</div>

---

> [!TIP]
> 🎁 **FREE PERPLEXITY PRO!** Sign up, ask your first question on the new Comet browser, and unlock premium features instantly for the first 30 days ➡️ [https://pplx.ai/pnd280](https://pplx.ai/pnd280)

---

> [!NOTE]
> Originally a [Perplexity AI](https://perplexity.ai/) extension, this repository has now been restructured into a suite of enhancements for multiple platforms and services.

## Supported Platforms/Services

### Perplexity AI

<div>
  <p>
    <a href="https://chromewebstore.google.com/detail/complexity/ffppmilmeaekegkpckebkeahjgmhggpj" target="_blank">
      <img src="https://img.shields.io/chrome-web-store/v/ffppmilmeaekegkpckebkeahjgmhggpj?label=Chrome%20Web%20Store" alt="Chrome Web Store">
    </a>
    <a href="https://addons.mozilla.org/en-US/firefox/addon/complexity/" target="_blank">
      <img src="https://img.shields.io/amo/v/complexity?label=Firefox%20Add-ons" alt="Firefox Add-ons">
    </a>
  </p>
  <p>
    <img src="https://img.shields.io/chrome-web-store/rating/ffppmilmeaekegkpckebkeahjgmhggpj?label=CWS%20rating" alt="Chrome Web Store Rating">
    <img src="https://img.shields.io/chrome-web-store/users/ffppmilmeaekegkpckebkeahjgmhggpj?label=CWS%20users" alt="Chrome Web Store Users">
    <img src="https://img.shields.io/amo/rating/complexity?label=AMO%20rating" alt="Mozilla Add-on Rating">
    <img src="https://img.shields.io/amo/users/complexity?label=AMO%20users" alt="Mozilla Add-on Users">
  </p>
</div>

- Provides a comprehensive set of added features and UI/UX improvements with excellent modularity and customization
- Supports 22 languages
- [**Supports the new Comet browser**](./perplexity/extension/docs/comet-enable-extensions.md)
- Supports Firefox Android
- Navigate to [`./perplexity/extension/`](./perplexity/extension/) for more information

## NextGen Resilient Features 🚀

### Feature Summary Table

| Feature | Status | Description | Implementation Path | Priority |
|---------|--------|-------------|-------------------|----------|
| **Resilient DOM Layer** | 📋 TODO | Self-healing DOM manipulation with fallback strategies | `src/core/resilient-dom/` | High |
| **CLI/Infra Sync** | 📋 TODO | Bidirectional synchronization between CLI tools and infrastructure | `src/cli-sync/` | Medium |
| **WASM Plugin Runtime** | 📋 TODO | High-performance WebAssembly plugin system with sandboxed execution | `src/wasm-runtime/` | High |
| **Homelab Mesh Mode** | 📋 TODO | Distributed homelab networking with auto-discovery and failover | `src/homelab-mesh/` | Medium |

### Architecture Diagrams

#### 1. Resilient DOM Layer Architecture

```mermaid
graph TD
    A[DOM Observer] --> B[Change Detection]
    B --> C{Mutation Type}
    C -->|Element Added| D[Element Tracker]
    C -->|Element Removed| E[Recovery Strategy]
    C -->|Attribute Changed| F[State Reconciler]
    
    D --> G[Fallback Selectors]
    E --> H[Re-injection Logic]
    F --> I[State Persistence]
    
    G --> J[Health Monitor]
    H --> J
    I --> J
    
    J --> K[Auto-Recovery]
    K --> L[Success Metrics]
    K --> M[Failure Logging]
    
    style A fill:#e1f5fe
    style J fill:#c8e6c9
    style K fill:#fff3e0
```

**TODO Implementation Stubs:**
- [ ] `src/core/resilient-dom/observer.ts` - DOM mutation observer with smart retry logic
- [ ] `src/core/resilient-dom/strategies/` - Fallback selector strategies
- [ ] `src/core/resilient-dom/health-monitor.ts` - Real-time DOM health monitoring
- [ ] `src/core/resilient-dom/recovery.ts` - Automated recovery mechanisms

#### 2. CLI/Infra Sync Flow

```mermaid
sequenceDiagram
    participant CLI as CLI Tool
    participant Sync as Sync Engine
    participant Config as Config Store
    participant Infra as Infrastructure
    
    CLI->>Sync: Command Executed
    Sync->>Config: Update State
    Config->>Sync: State Changed
    Sync->>Infra: Apply Changes
    Infra-->>Sync: Status Update
    Sync-->>CLI: Confirmation
    
    Note over Sync: Bidirectional Sync
    
    Infra->>Sync: External Change
    Sync->>Config: Update State
    Config->>CLI: Notify Changes
    CLI->>CLI: Auto-adjust
```

**TODO Implementation Stubs:**
- [ ] `src/cli-sync/engine.ts` - Core synchronization engine
- [ ] `src/cli-sync/adapters/` - CLI tool adapters (docker, kubectl, terraform, etc.)
- [ ] `src/cli-sync/config-store.ts` - Centralized configuration management
- [ ] `src/cli-sync/webhook-server.ts` - Infrastructure change webhook listener

#### 3. WASM Plugin Runtime System

```mermaid
flowchart TB
    A[Plugin Manager] --> B[WASM Loader]
    A --> C[Sandbox Controller]
    
    B --> D[WASM Module]
    C --> E[Memory Isolation]
    C --> F[API Restrictions]
    
    D --> G[Plugin Interface]
    E --> G
    F --> G
    
    G --> H[Host Communication]
    H --> I[Event Bus]
    
    I --> J[Plugin Registry]
    I --> K[Performance Monitor]
    
    J --> L[Hot Reload]
    K --> M[Resource Limits]
    
    subgraph "Security Boundary"
        D
        E
        F
        G
    end
    
    style D fill:#f3e5f5
    style E fill:#e8f5e8
    style F fill:#fff8e1
```

**TODO Implementation Stubs:**
- [ ] `src/wasm-runtime/loader.ts` - WASM module loading and validation
- [ ] `src/wasm-runtime/sandbox/` - Security sandbox implementation
- [ ] `src/wasm-runtime/api/` - Plugin API definitions and bindings
- [ ] `src/wasm-runtime/registry.ts` - Plugin discovery and management

#### 4. Homelab Mesh Network Architecture

```mermaid
graph TB
    subgraph "Node A (Primary)"
        A1[Mesh Agent]
        A2[Service Discovery]
        A3[Load Balancer]
    end
    
    subgraph "Node B (Secondary)"
        B1[Mesh Agent]
        B2[Service Discovery]
        B3[Health Monitor]
    end
    
    subgraph "Node C (Edge)"
        C1[Mesh Agent]
        C2[Service Discovery]
        C3[Proxy Gateway]
    end
    
    A1 <-->|Gossip Protocol| B1
    B1 <-->|Gossip Protocol| C1
    C1 <-->|Gossip Protocol| A1
    
    A2 --> D[Service Registry]
    B2 --> D
    C2 --> D
    
    D --> E[Auto-Discovery]
    E --> F[Failover Logic]
    F --> G[Traffic Routing]
    
    A3 --> H[External Services]
    B3 --> I[Health Checks]
    C3 --> J[Edge Routing]
    
    style D fill:#e3f2fd
    style F fill:#f3e5f5
    style G fill:#e8f5e8
```

**TODO Implementation Stubs:**
- [ ] `src/homelab-mesh/agent.ts` - Core mesh networking agent
- [ ] `src/homelab-mesh/discovery/` - Service discovery protocols
- [ ] `src/homelab-mesh/gossip.ts` - Gossip protocol implementation
- [ ] `src/homelab-mesh/failover.ts` - Automated failover mechanisms
- [ ] `src/homelab-mesh/proxy/` - Traffic routing and load balancing

### Development Roadmap

#### Phase 1: Foundation (Q1 2025)
- [ ] Implement Resilient DOM Layer core functionality
- [ ] Set up WASM Plugin Runtime basic sandbox
- [ ] Create CLI/Infra Sync proof of concept

#### Phase 2: Integration (Q2 2025)
- [ ] Connect Resilient DOM with existing extension system
- [ ] Develop WASM plugin API specifications
- [ ] Implement basic Homelab Mesh networking

#### Phase 3: Production (Q3 2025)
- [ ] Performance optimization and stress testing
- [ ] Security audits and vulnerability assessments
- [ ] Documentation and community engagement

#### Phase 4: Ecosystem (Q4 2025)
- [ ] Third-party plugin marketplace
- [ ] Advanced mesh networking features
- [ ] Enterprise deployment tools

### Configuration Stubs

**Main Configuration Entry Point:**
```typescript
// TODO: src/config/nextgen-features.ts
export interface NextGenConfig {
  resilientDom: {
    enabled: boolean;
    strategies: string[];
    retryAttempts: number;
  };
  cliSync: {
    enabled: boolean;
    tools: string[];
    syncInterval: number;
  };
  wasmRuntime: {
    enabled: boolean;
    sandboxLevel: 'strict' | 'permissive';
    memoryLimit: number;
  };
  homelabMesh: {
    enabled: boolean;
    nodeRole: 'primary' | 'secondary' | 'edge';
    discoveryPort: number;
  };
}
```

**Feature Flag System:**
```typescript
// TODO: src/feature-flags/nextgen.ts
export const NEXTGEN_FEATURES = {
  RESILIENT_DOM: 'resilient-dom-v1',
  CLI_SYNC: 'cli-infra-sync-v1',
  WASM_RUNTIME: 'wasm-plugin-runtime-v1',
  HOMELAB_MESH: 'homelab-mesh-mode-v1',
} as const;
```

## Donate/Sponsor

<div>
  <a href="https://paypal.me/pnd280" target="_blank">
    <img src="https://img.shields.io/badge/Paypal-blue?logo=paypal&logoColor=white" alt="Paypal">
  </a>
  <a href="https://ko-fi.com/pnd280" target="_blank">
    <img src="https://img.shields.io/badge/Ko--fi-orange?logo=kofi&logoColor=white" alt="Ko-fi">
  </a>
</div>

## Community

<div>
  <a href="https://discord.cplx.app" target="_blank">
    <img src="https://img.shields.io/discord/1245377426331144304?logo=discord&label=discord&link=https%3A%2F%2Fdiscord.gg%2FfxzqdkwmWx" alt="Discord">
  </a>
</div>

## License

- [Full license terms](./LICENSE)
