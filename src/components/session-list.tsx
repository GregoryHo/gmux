import { Box, Text } from "ink";
import type { AgentSession, AgentStatus } from "../types.js";

export interface SessionListProps {
  sessions: AgentSession[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
}

/** Map agent status to a display dot character. */
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

/** Map agent status to a display label. */
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

/**
 * Truncate a file path to a compact form: ~/G/A/project style.
 * Replaces home dir with ~, abbreviates intermediate directories to first char.
 */
export function truncateCwd(cwd: string): string {
  const home = process.env["HOME"] ?? "";
  let display = cwd;

  if (home && display.startsWith(home)) {
    display = "~" + display.slice(home.length);
  }

  const parts = display.split("/");
  if (parts.length <= 2) return display;

  // Keep first element (~ or empty for /) and last element full,
  // abbreviate everything in between
  const abbreviated = parts.map((part, i) => {
    if (i === 0 || i === parts.length - 1) return part;
    return part.charAt(0).toUpperCase();
  });

  return abbreviated.join("/");
}

/**
 * Format a duration from seconds to human-readable string.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
}

/**
 * Extract a git branch name from pane content if present.
 * Looks for common branch display patterns.
 */
export function extractBranch(session: AgentSession): string {
  // Try to find branch from pane content — common patterns:
  // "on branch feat/foo", "main", "feat/bar" at a prompt
  const branchMatch = session.paneContent.match(
    /(?:on branch |branch[:\s]+)([^\s,)]+)/i,
  );
  if (branchMatch) return branchMatch[1];

  // Fall back to looking for git-like patterns in the cwd or content
  const gitMatch = session.paneContent.match(
    /\b(main|master|develop|feat\/[^\s]+|fix\/[^\s]+|feature\/[^\s]+)\b/,
  );
  if (gitMatch) return gitMatch[1];

  return "";
}

/**
 * SessionList component - navigable list of agent sessions.
 * Navigation is handled by the parent via selectedIndex prop.
 */
export function SessionList({ sessions, selectedIndex }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No agent sessions detected</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {sessions.map((session, index) => {
        const isSelected = index === selectedIndex;
        const indicator = isSelected ? "▸" : " ";
        const dot = statusDot(session.status);
        const label = statusLabel(session.status);
        const branch = extractBranch(session);
        const cwd = truncateCwd(session.cwd);

        return (
          <Box key={session.target} gap={1} paddingX={1}>
            <Text>{indicator}</Text>
            <Text>{dot}</Text>
            <Text bold>{session.sessionName}</Text>
            <Text dimColor>{label}</Text>
            {branch ? <Text color="cyan">{branch}</Text> : null}
            <Text dimColor>{cwd}</Text>
            <Text dimColor>{session.command}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
