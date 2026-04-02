/**
 * Shared types for gmux agent detection and monitoring.
 */

/** A tmux pane that has been identified as running an AI agent. */
export interface AgentPane {
  /** tmux target address: "session_name:window_index.pane_index" */
  target: string;
  /** tmux session name */
  sessionName: string;
  /** The detected command (Claude Code version string) */
  command: string;
  /** Current working directory of the pane */
  cwd: string;
  /** TTY path of the pane */
  tty: string;
  /** Process ID of the pane */
  pid: number;
}

/** Detected agent status from pane content heuristics or socket push. */
export type AgentStatus = "active" | "idle" | "needs_attention" | "unknown";

/** Metadata extracted from pane content. */
export interface PaneMetadata {
  /** Last assistant output snippet, or null if not parseable */
  lastOutput: string | null;
  /** Detected model name, or null */
  model: string | null;
  /** Context window usage percentage (0-100), or null */
  contextPct: number | null;
}

/** Full agent session: pane info + status + metadata. */
export interface AgentSession extends AgentPane {
  status: AgentStatus;
  metadata: PaneMetadata;
  /** Raw captured pane content from last poll */
  paneContent: string;
}
