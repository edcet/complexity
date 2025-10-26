import { StateCreator } from 'zustand';
import { CommandMenuStoreState } from '../types';

export interface UsageHistoryState {
  commandUsage: Record<string, { count: number; lastUsed: number }>;
  showLegacyCommands: boolean;
}

export interface UsageHistoryActions {
  trackCommandUsage: (commandValue: string) => void;
  toggleShowLegacyCommands: () => void;
  getCommandsByInvertedRecency: () => string[];
}

export type UsageHistorySlice = UsageHistoryState & UsageHistoryActions;

export const createUsageHistorySlice: StateCreator<
  CommandMenuStoreState,
  [],
  [],
  UsageHistorySlice
> = (set, get) => ({
  commandUsage: {},
  showLegacyCommands: false,

  trackCommandUsage: (commandValue: string) => {
    const now = Date.now();
    set((state) => ({
      commandUsage: {
        ...state.commandUsage,
        [commandValue]: {
          count: (state.commandUsage[commandValue]?.count || 0) + 1,
          lastUsed: now,
        },
      },
    }));
  },

  toggleShowLegacyCommands: () => {
    set((state) => ({
      showLegacyCommands: !state.showLegacyCommands,
    }));
  },

  getCommandsByInvertedRecency: () => {
    const usage = get().commandUsage;
    return Object.entries(usage)
      .sort((a, b) => {
        // Sort by lastUsed ascending (oldest first)
        return a[1].lastUsed - b[1].lastUsed;
      })
      .map(([value]) => value);
  },
});
