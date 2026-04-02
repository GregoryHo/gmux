import { Box, Text } from "ink";
import type { AgentSession, AgentStatus } from "../types.js";

export interface SessionListProps {
  sessions: AgentSession[];
  selectedIndex: number;
  dimmed?: boolean;
  maxHeight?: number;
  searchQuery?: string;
}

export function statusColor(status: AgentStatus): { color?: string; dimColor?: boolean } {
  switch (status) {
    case "active": return { color: "green" };
    case "idle": return { dimColor: true };
    case "needs_attention": return { color: "yellow" };
    default: return { color: "red", dimColor: true };
  }
}

function statusDot(status: AgentStatus): string {
  switch (status) {
    case "active":
      return "●";
    case "idle":
      return "○";
    case "needs_attention":
      return "⚡";
    default:
      return "?";
  }
}

function statusLabel(status: AgentStatus): string {
  switch (status) {
    case "active":
      return "active";
    case "idle":
      return "idle";
    case "needs_attention":
      return "attention";
    default:
      return "unknown";
  }
}

export function truncateCwd(cwd: string): string {
  const home = process.env["HOME"] ?? "";
  let display = cwd;

  if (home && display.startsWith(home)) {
    display = "~" + display.slice(home.length);
  }

  const parts = display.split("/");
  if (parts.length <= 2) return display;

  const abbreviated = parts.map((part, i) => {
    if (i === 0 || i === parts.length - 1) return part;
    return part.charAt(0).toUpperCase();
  });

  return abbreviated.join("/");
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
}

export function extractBranch(session: AgentSession): string {
  const branchMatch = session.paneContent.match(
    /(?:on branch |branch[:\s]+)([^\s,)]+)/i,
  );
  if (branchMatch) return branchMatch[1];

  const gitMatch = session.paneContent.match(
    /\b(main|master|develop|feat\/[^\s]+|fix\/[^\s]+|feature\/[^\s]+)\b/,
  );
  if (gitMatch) return gitMatch[1];

  return "";
}

export function SessionList({
  sessions,
  selectedIndex,
  dimmed = false,
  maxHeight,
  searchQuery,
}: SessionListProps) {
  const filtered = searchQuery
    ? sessions.filter((s) =>
        s.sessionName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sessions;

  if (filtered.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>
          {searchQuery ? "No matching sessions" : "No agent sessions detected"}
        </Text>
      </Box>
    );
  }

  let visibleSessions = filtered;
  let showUpIndicator = false;
  let showDownIndicator = false;

  if (maxHeight && filtered.length > maxHeight) {
    const halfWindow = Math.floor(maxHeight / 2);
    let start = Math.max(0, selectedIndex - halfWindow);
    const end = Math.min(filtered.length, start + maxHeight);
    if (end === filtered.length) {
      start = Math.max(0, end - maxHeight);
    }
    visibleSessions = filtered.slice(start, end);
    showUpIndicator = start > 0;
    showDownIndicator = end < filtered.length;
  }

  return (
    <Box flexDirection="column">
      {showUpIndicator ? (
        <Box paddingX={1}><Text dimColor>▲ more</Text></Box>
      ) : null}
      {visibleSessions.map((session) => {
        const actualIndex = sessions.indexOf(session);
        const isSelected = actualIndex === selectedIndex;
        const indicator = isSelected ? "▸" : " ";
        const dot = statusDot(session.status);
        const label = statusLabel(session.status);
        const branch = extractBranch(session);
        const cwd = truncateCwd(session.cwd);

        return (
          <Box key={session.target} gap={1} paddingX={1}>
            <Text dimColor={dimmed}>{indicator}</Text>
            <Text {...(dimmed ? { dimColor: true, color: "yellow" } : statusColor(session.status))}>{dot}</Text>
            <Text bold dimColor={dimmed}>{session.sessionName}</Text>
            <Text dimColor>{label}</Text>
            {branch ? <Text color="cyan" dimColor={dimmed}>{branch}</Text> : null}
            <Text dimColor>{cwd}</Text>
            <Text dimColor>{session.command}</Text>
          </Box>
        );
      })}
      {showDownIndicator ? (
        <Box paddingX={1}><Text dimColor>▼ more</Text></Box>
      ) : null}
    </Box>
  );
}
