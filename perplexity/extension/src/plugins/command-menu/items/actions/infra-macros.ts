import type { CommandItemProps } from "@/plugins/command-menu/types";

/**
 * Personal infrastructure management macros/scripts
 * These are injected at top of command palette for quick access to system tools
 */
export const infraMacroItems: CommandItemProps[] = [
  {
    value: "macro:pfctl-status",
    title: "pfctl: Show firewall status",
    keywords: ["firewall", "pf", "pfctl", "status", "network", "security"],
    group: "🔧 Infrastructure Macros",
    priority: 100, // High priority to appear at top
    show: true,
    eager: true,
    onSelect: () => {
      // Copy command to clipboard
      navigator.clipboard.writeText("sudo pfctl -s all");
      // Show notification
      console.log("[pfctl] Command copied: sudo pfctl -s all");
    },
  },
  {
    value: "macro:pfctl-enable",
    title: "pfctl: Enable firewall",
    keywords: ["firewall", "pf", "pfctl", "enable", "network", "security"],
    group: "🔧 Infrastructure Macros",
    priority: 99,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText("sudo pfctl -e");
      console.log("[pfctl] Command copied: sudo pfctl -e");
    },
  },
  {
    value: "macro:pfctl-disable",
    title: "pfctl: Disable firewall",
    keywords: ["firewall", "pf", "pfctl", "disable", "network", "security"],
    group: "🔧 Infrastructure Macros",
    priority: 98,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText("sudo pfctl -d");
      console.log("[pfctl] Command copied: sudo pfctl -d");
    },
  },
  {
    value: "macro:ipv6-disable",
    title: "IPv6: Disable all interfaces",
    keywords: ["ipv6", "network", "disable", "interface"],
    group: "🔧 Infrastructure Macros",
    priority: 97,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText(
        "networksetup -listallnetworkservices | tail -n +2 | while read service; do sudo networksetup -setv6off \"$service\"; done"
      );
      console.log("[IPv6] Command copied: disable all interfaces");
    },
  },
  {
    value: "macro:ipv6-enable",
    title: "IPv6: Enable all interfaces",
    keywords: ["ipv6", "network", "enable", "interface"],
    group: "🔧 Infrastructure Macros",
    priority: 96,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText(
        "networksetup -listallnetworkservices | tail -n +2 | while read service; do sudo networksetup -setv6automatic \"$service\"; done"
      );
      console.log("[IPv6] Command copied: enable all interfaces");
    },
  },
  {
    value: "macro:ipv6-status",
    title: "IPv6: Check status all interfaces",
    keywords: ["ipv6", "network", "status", "check", "interface"],
    group: "🔧 Infrastructure Macros",
    priority: 95,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText(
        "networksetup -listallnetworkservices | tail -n +2 | while read service; do echo \"$service:\"; networksetup -getinfo \"$service\" | grep IPv6; done"
      );
      console.log("[IPv6] Command copied: check status all interfaces");
    },
  },
  {
    value: "macro:tailscale-status",
    title: "Tailscale: Show connection status",
    keywords: ["tailscale", "vpn", "network", "status", "mesh"],
    group: "🔧 Infrastructure Macros",
    priority: 94,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText("tailscale status");
      console.log("[Tailscale] Command copied: tailscale status");
    },
  },
  {
    value: "macro:tailscale-up",
    title: "Tailscale: Connect to network",
    keywords: ["tailscale", "vpn", "network", "connect", "up"],
    group: "🔧 Infrastructure Macros",
    priority: 93,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText("tailscale up");
      console.log("[Tailscale] Command copied: tailscale up");
    },
  },
  {
    value: "macro:tailscale-down",
    title: "Tailscale: Disconnect from network",
    keywords: ["tailscale", "vpn", "network", "disconnect", "down"],
    group: "🔧 Infrastructure Macros",
    priority: 92,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText("tailscale down");
      console.log("[Tailscale] Command copied: tailscale down");
    },
  },
  {
    value: "macro:tailscale-ip",
    title: "Tailscale: Show my IP addresses",
    keywords: ["tailscale", "vpn", "ip", "address"],
    group: "🔧 Infrastructure Macros",
    priority: 91,
    show: true,
    eager: true,
    onSelect: () => {
      navigator.clipboard.writeText("tailscale ip");
      console.log("[Tailscale] Command copied: tailscale ip");
    },
  },
];
