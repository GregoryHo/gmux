import type { AgentStatus } from "./types.js";

/**
 * Classify agent status from captured pane content using pattern heuristics.
 *
 * Priority order (first match wins):
 * 1. needs_attention — user action required ([Y/n], proceed?)
 * 2. active — agent is working (Whisking, thinking)
 * 3. idle — agent is waiting for input (-- INSERT --)
 * 4. unknown — no recognized pattern
 */
export function classifyStatus(paneContent: string): AgentStatus {
  // Check for prompts that need user attention (highest priority)
  if (/\[Y\/n\]|proceed\?/i.test(paneContent)) {
    return "needs_attention";
  }

  // Check for active processing indicators
  if (/Whisking|thinking/i.test(paneContent)) {
    return "active";
  }

  // Check for idle/input mode
  if (/-- INSERT --/.test(paneContent)) {
    return "idle";
  }

  return "unknown";
}
