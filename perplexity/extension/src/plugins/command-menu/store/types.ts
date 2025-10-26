import type { StateCreator } from "zustand/vanilla";
import type { FooterSlice } from "@/plugins/command-menu/store/slices/footer";
import type { PagesStackSlice } from "@/plugins/command-menu/store/slices/pages";
import type { SidecarSlice } from "@/plugins/command-menu/store/slices/sidecar";
import type { StatesSlice } from "@/plugins/command-menu/store/slices/states";
import type { UsageHistorySlice } from "@/plugins/command-menu/store/slices/usage-history";

export type CommandMenuStoreType = StatesSlice &
  PagesStackSlice &
  FooterSlice &
  SidecarSlice &
  UsageHistorySlice;

export type CommandMenuStoreState = CommandMenuStoreType;

export type BoundStateCreator<T> = StateCreator<
  CommandMenuStoreType,
  [["zustand/subscribeWithSelector", never], ["zustand/immer", never]],
  [],
  T
>;
