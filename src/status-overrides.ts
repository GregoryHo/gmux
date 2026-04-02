import type { AgentStatus } from "./types.js";

/**
 * Stores per-pane status overrides from socket push events.
 * Socket overrides take priority over heuristic classification.
 * Overrides persist until replaced by a new socket event or cleared
 * when the pane disappears.
 */
export class StatusOverrideStore {
  private overrides = new Map<string, AgentStatus>();

  /** Set a socket-sourced status override for a pane target. */
  set(target: string, status: AgentStatus): void {
    this.overrides.set(target, status);
  }

  /** Get the override for a pane, or undefined if none exists. */
  get(target: string): AgentStatus | undefined {
    return this.overrides.get(target);
  }

  /** Check if a pane has a socket override. */
  has(target: string): boolean {
    return this.overrides.has(target);
  }

  /** Clear override for a specific pane (e.g., when pane disappears). */
  clear(target: string): void {
    this.overrides.delete(target);
  }

  /** Remove overrides for panes that no longer exist. */
  pruneStale(activeTargets: Set<string>): void {
    for (const target of this.overrides.keys()) {
      if (!activeTargets.has(target)) {
        this.overrides.delete(target);
      }
    }
  }

  /** Number of active overrides. */
  get size(): number {
    return this.overrides.size;
  }
}
