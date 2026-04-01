import type { AgentStatus } from "./types.js";

/**
 * Generic progress words that indicate an agent is actively working.
 * Inspired by dmux's cross-agent heuristic approach.
 * These are checked against the BOTTOM region of the pane to avoid
 * false positives from conversation content.
 */
const PROGRESS_WORDS = [
  "thinking", "crunching", "whisking", "planning", "analyzing",
  "building", "testing", "running", "searching", "reviewing",
  "loading", "processing", "writing", "reading", "editing",
  "generating", "reasoning", "compiling", "scanning", "executing",
  "refactoring", "fixing", "checking", "indexing", "summarizing",
];

const PROGRESS_PATTERN = new RegExp(
  `\\b(${PROGRESS_WORDS.join("|")})\\.{0,3}\\b`,
  "i",
);

/**
 * Classify agent status from captured pane content using generic heuristics.
 *
 * Priority order:
 * 1. needs_attention — user action required ([Y/n], proceed?)
 * 2. active (esc) — "esc to interrupt/cancel" (most reliable cross-agent signal)
 * 3. active (progress) — generic progress words in bottom 15 lines
 * 4. idle — "-- INSERT --" present with NO active signals
 * 5. unknown — fallback
 */
export function classifyStatus(paneContent: string): AgentStatus {
  if (/\[Y\/n\]|proceed\?/i.test(paneContent)) {
    return "needs_attention";
  }

  // "esc to interrupt" is the most reliable active signal — search full pane
  if (/esc to (interrupt|cancel|stop|abort)/i.test(paneContent)) {
    return "active";
  }

  // Check progress words in the bottom region only (avoid conversation false positives)
  const lines = paneContent.split("\n");
  const bottomRegion = lines.slice(-15).join("\n");
  if (PROGRESS_PATTERN.test(bottomRegion)) {
    return "active";
  }

  if (/-- INSERT --/.test(paneContent)) {
    return "idle";
  }

  return "unknown";
}
