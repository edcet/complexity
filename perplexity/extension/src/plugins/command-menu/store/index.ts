import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { createFooterSlice } from "@/plugins/command-menu/store/slices/footer";
import { createPagesStackSlice } from "@/plugins/command-menu/store/slices/pages";
import { createSidecarSlice } from "@/plugins/command-menu/store/slices/sidecar";
import { createStatesSlice } from "@/plugins/command-menu/store/slices/states";
import { createUsageHistorySlice } from "@/plugins/command-menu/store/slices/usage-history";
import type { CommandMenuStoreType } from "@/plugins/command-menu/store/types";

export const commandMenuStore = createWithEqualityFn<CommandMenuStoreType>()(
  subscribeWithSelector(
    immer((set, get, ...props) => ({
      ...createStatesSlice(set, get, ...props),
      ...createPagesStackSlice(set, get, ...props),
      ...createFooterSlice(set, get, ...props),
      ...createSidecarSlice(set, get, ...props),
      ...createUsageHistorySlice(set, get, ...props),
    })),
  ),
);

export const useCommandMenuStore = commandMenuStore;
