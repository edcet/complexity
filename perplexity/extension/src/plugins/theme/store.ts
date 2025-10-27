import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LegacyConfig {
  id: string;
  name: string;
  version: string;
  lastModified: string;
  status: 'active' | 'deprecated' | 'archived';
}

interface InfraIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  created: string;
  age: number; // days
}

interface FavoriteOverlay {
  id: string;
  name: string;
  starred: boolean;
  order: number;
}

interface ThemeState {
  // Theme settings
  theme: 'light' | 'dark' | 'auto';
  colorPreset: string;
  dnsAccent: string | null;
  
  // Legacy configs
  legacyConfigs: LegacyConfig[];
  oldestIssues: InfraIssue[];
  
  // Favorites
  favoriteOverlays: FavoriteOverlay[];
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setColorPreset: (preset: string) => void;
  setDnsAccent: (color: string | null) => void;
  addLegacyConfig: (config: LegacyConfig) => void;
  removeLegacyConfig: (id: string) => void;
  addIssue: (issue: InfraIssue) => void;
  resolveIssue: (id: string) => void;
  toggleFavorite: (overlayId: string) => void;
  reorderFavorites: (favorites: FavoriteOverlay[]) => void;
  init: () => void;
}

export const useThemeStore = create<ThemeState>()(persist(
  (set, get) => ({
    // Initial state
    theme: 'auto',
    colorPreset: 'default',
    dnsAccent: null,
    legacyConfigs: [],
    oldestIssues: [],
    favoriteOverlays: [],

    // Actions
    setTheme: (theme) => set({ theme }),
    
    setColorPreset: (preset) => set({ colorPreset: preset }),
    
    setDnsAccent: (color) => set({ dnsAccent: color }),
    
    addLegacyConfig: (config) => set((state) => ({
      legacyConfigs: [...state.legacyConfigs, config].sort((a, b) => 
        new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
      ),
    })),
    
    removeLegacyConfig: (id) => set((state) => ({
      legacyConfigs: state.legacyConfigs.filter(c => c.id !== id),
    })),
    
    addIssue: (issue) => set((state) => ({
      oldestIssues: [...state.oldestIssues, issue].sort((a, b) => b.age - a.age).slice(0, 10),
    })),
    
    resolveIssue: (id) => set((state) => ({
      oldestIssues: state.oldestIssues.filter(i => i.id !== id),
    })),
    
    toggleFavorite: (overlayId) => set((state) => {
      const existing = state.favoriteOverlays.find(f => f.id === overlayId);
      if (existing) {
        return {
          favoriteOverlays: state.favoriteOverlays.map(f => 
            f.id === overlayId ? { ...f, starred: !f.starred } : f
          ),
        };
      }
      return {
        favoriteOverlays: [
          ...state.favoriteOverlays,
          { id: overlayId, name: overlayId, starred: true, order: state.favoriteOverlays.length },
        ],
      };
    }),
    
    reorderFavorites: (favorites) => set({ favoriteOverlays: favorites }),
    
    init: () => {
      // Initialize with mock data for demo
      const legacyConfigs: LegacyConfig[] = [
        {
          id: 'cfg-001',
          name: 'Legacy Auth Config',
          version: '1.2.3',
          lastModified: '2023-01-15T10:00:00Z',
          status: 'deprecated',
        },
        {
          id: 'cfg-002',
          name: 'Old API Endpoints',
          version: '2.0.1',
          lastModified: '2023-03-20T14:30:00Z',
          status: 'active',
        },
      ];

      const oldestIssues: InfraIssue[] = [
        {
          id: 'iss-001',
          title: 'Memory leak in background worker',
          severity: 'high',
          created: '2024-08-10T08:00:00Z',
          age: 78,
        },
        {
          id: 'iss-002',
          title: 'DNS resolution timeout',
          severity: 'medium',
          created: '2024-09-15T16:20:00Z',
          age: 42,
        },
      ];

      set({ legacyConfigs, oldestIssues });
    },
  }),
  {
    name: 'theme-storage',
    partialize: (state) => ({
      theme: state.theme,
      colorPreset: state.colorPreset,
      favoriteOverlays: state.favoriteOverlays,
    }),
  }
));
