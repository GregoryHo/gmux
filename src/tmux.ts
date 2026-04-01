import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import type { AgentPane } from "./types.js";

/** Pattern matching Claude Code's version-as-process-name convention. */
const AGENT_COMMAND_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Format string for tmux list-panes.
 * Fields: session_name:window_index.pane_index | pane_current_command | cwd | tty | pid
 */
const FORMAT_STRING =
  "#{session_name}:#{window_index}.#{pane_index}|#{pane_current_command}|#{pane_current_path}|#{pane_tty}|#{pane_pid}";

/** Cached tmux binary path, resolved once per process. */
let tmuxBin: string | null = null;

/**
 * Discover the tmux binary path.
 * Checks common locations on macOS ARM (/opt/homebrew/bin/tmux) and falls
 * back to plain "tmux" (relying on PATH).
 */
export async function findTmuxBinary(): Promise<string> {
  if (tmuxBin !== null) return tmuxBin;

  const candidates = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux", "/usr/bin/tmux"];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      tmuxBin = candidate;
      return tmuxBin;
    } catch {
      // try next
    }
  }

  // Fall back to PATH resolution
  tmuxBin = "tmux";
  return tmuxBin;
}

/**
 * Run a tmux command and return stdout.
 * Uses execFile (no shell) for safety.
 */
export function runTmux(args: string[]): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const bin = await findTmuxBinary();
    execFile(bin, args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`tmux ${args[0]} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Parse a single line of tmux list-panes output into an AgentPane, or null
 * if the line doesn't match an agent pane.
 */
export function parsePaneLine(line: string): AgentPane | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  const parts = trimmed.split("|");
  if (parts.length !== 5) return null;

  const [target, command, cwd, tty, pidStr] = parts;
  const pid = parseInt(pidStr, 10);

  if (Number.isNaN(pid)) return null;
  if (!AGENT_COMMAND_PATTERN.test(command)) return null;

  // Extract session name from target "session_name:window.pane"
  const colonIdx = target.indexOf(":");
  const sessionName = colonIdx > 0 ? target.substring(0, colonIdx) : target;

  return { target, sessionName, command, cwd, tty, pid };
}

/**
 * Get the parent PID of the current process.
 * Used to also exclude the parent of gmux (e.g. the shell that launched it).
 */
function getSelfPids(): Set<number> {
  const pids = new Set<number>();
  pids.add(process.pid);
  if (process.ppid) {
    pids.add(process.ppid);
  }
  return pids;
}

/**
 * List all tmux panes that are running AI agents.
 * Automatically excludes gmux's own pane (and its parent).
 */
export async function listAgentPanes(): Promise<AgentPane[]> {
  const stdout = await runTmux(["list-panes", "-a", "-F", FORMAT_STRING]);
  return parseListPanesOutput(stdout);
}

/**
 * Parse the full output of `tmux list-panes -a -F` into AgentPane[].
 * Filters for agent panes and excludes self.
 */
export function parseListPanesOutput(
  stdout: string,
  selfPids?: Set<number>,
): AgentPane[] {
  const excludePids = selfPids ?? getSelfPids();
  const lines = stdout.split("\n");
  const panes: AgentPane[] = [];

  for (const line of lines) {
    const pane = parsePaneLine(line);
    if (pane === null) continue;
    if (excludePids.has(pane.pid)) continue;
    panes.push(pane);
  }

  return panes;
}

/**
 * Capture the visible content of a specific tmux pane.
 */
export async function capturePaneContent(target: string): Promise<string> {
  return runTmux(["capture-pane", "-t", target, "-p"]);
}
