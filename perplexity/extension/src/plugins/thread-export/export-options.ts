import FaFileTypePdf from "@/components/icons/FaFileTypePdf";
import FaMarkdown from "@/components/icons/FaMarkdown";
import TablerBrandHtml5 from "~icons/tabler/brand-html5";
import { Icon } from "@iconify/react";

export const EXPORT_OPTIONS = [
  {
    label: "Legacy Network Log",
    value: "legacy-network",
    icon: FaMarkdown,
    isDisabled: false,
    template: "network-troubleshooting",
  },
  {
    label: "Router/Firewall Debug",
    value: "router-debug",
    icon: FaMarkdown,
    isDisabled: false,
    template: "router-firewall",
  },
  {
    label: "Infra Change Diff",
    value: "infra-diff",
    icon: FaMarkdown,
    isDisabled: false,
    template: "infra-changes",
  },
  {
    label: "Markdown",
    value: "markdown",
    icon: FaMarkdown,
    isDisabled: false,
  },
  {
    label: "PDF",
    value: "pdf",
    icon: FaFileTypePdf,
    isDisabled: false,
  },
  {
    label: "Formatted text (soon)",
    value: "html",
    icon: TablerBrandHtml5,
    isDisabled: true,
  },
] as const;

export type ExportOption = (typeof EXPORT_OPTIONS)[number];

export interface ExportTemplate {
  name: string;
  header: string;
  vendor?: string;
  tags?: string[];
  lastUsed?: Date;
  starred?: boolean;
}

export const EXPORT_TEMPLATES: Record<string, ExportTemplate> = {
  "network-troubleshooting": {
    name: "Network Troubleshooting Log",
    header: "# Network Troubleshooting Log\n\n**Date:** {date}\n**Issue:** {title}\n\n## Diagnostic Steps\n\n",
    tags: ["network", "troubleshooting"],
  },
  "router-firewall": {
    name: "Router/Firewall Debug",
    header: "# Router/Firewall Debug Session\n\n**Date:** {date}\n**Device:** {title}\n\n## Configuration Review\n\n",
    tags: ["router", "firewall", "config"],
  },
  "infra-changes": {
    name: "Infrastructure Change Log",
    header: "# Infrastructure Change Log\n\n**Date:** {date}\n**Change:** {title}\n\n## Before/After Analysis\n\n",
    tags: ["infrastructure", "changes", "diff"],
  },
};
