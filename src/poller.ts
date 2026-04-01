import { EventEmitter } from "node:events";
import type { AgentPane, AgentSession } from "./types.js";
import { listAgentPanes, capturePaneContent } from "./tmux.js";
import { classifyStatus } from "./heuristics.js";
import { extractMetadata } from "./metadata.js";

export type PollerEvent = "add" | "remove" | "update" | "error";

export interface PollerEvents {
  add: (session: AgentSession) => void;
  remove: (target: string) => void;
  update: (sessions: AgentSession[]) => void;
  error: (err: Error) => void;
}

/**
 * Polls tmux at a configurable interval to detect agent panes, capture
 * their content, classify status, and extract metadata.
 *
 * Emits events when panes are added or removed, and on each update cycle.
 */
export class TmuxPoller extends EventEmitter {
  private interval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private previousTargets: Map<string, AgentSession> = new Map();
  private _sessions: AgentSession[] = [];
  private _polling = false;

  constructor(pollInterval: number = 3000) {
    super();
    this.interval = pollInterval;
  }

  /** Current snapshot of all detected agent sessions. */
  get sessions(): ReadonlyArray<AgentSession> {
    return this._sessions;
  }

  /** Whether the poller is actively running. */
  get running(): boolean {
    return this.timer !== null;
  }

  /** Start polling. No-op if already running. */
  start(): void {
    if (this.timer !== null) return;

    // Run immediately, then on interval
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.interval);
  }

  /** Stop polling. No-op if not running. */
  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Execute a single poll cycle.
   * Public for testing — normally called internally by start().
   */
  async poll(): Promise<void> {
    if (this._polling) return; // prevent overlapping polls
    this._polling = true;

    try {
      const panes = await listAgentPanes();
      const sessions = await this.enrichPanes(panes);
      this.diffAndEmit(sessions);
      this._sessions = sessions;
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      this._polling = false;
    }
  }

  /**
   * Enrich raw panes with captured content, status classification,
   * and metadata extraction.
   */
  private async enrichPanes(panes: AgentPane[]): Promise<AgentSession[]> {
    const results: AgentSession[] = [];

    for (const pane of panes) {
      let paneContent = "";
      try {
        paneContent = await capturePaneContent(pane.target);
      } catch {
        // Pane may have disappeared between list and capture — skip
        continue;
      }

      const status = classifyStatus(paneContent);
      const metadata = extractMetadata(paneContent);

      results.push({
        ...pane,
        status,
        metadata,
        paneContent,
      });
    }

    return results;
  }

  /**
   * Compare new session list against previous state.
   * Emits 'add' for new panes, 'remove' for disappeared panes,
   * and 'update' with the full new list.
   */
  private diffAndEmit(newSessions: AgentSession[]): void {
    const newTargets = new Map<string, AgentSession>();
    for (const session of newSessions) {
      newTargets.set(session.target, session);
    }

    // Detect removals
    for (const [target] of this.previousTargets) {
      if (!newTargets.has(target)) {
        this.emit("remove", target);
      }
    }

    // Detect additions
    for (const [target, session] of newTargets) {
      if (!this.previousTargets.has(target)) {
        this.emit("add", session);
      }
    }

    this.previousTargets = newTargets;
    this.emit("update", newSessions);
  }
}

/**
 * Compute the diff between previous and current pane lists.
 * Exported for direct testing of the diff logic.
 */
export function computeDiff(
  previous: AgentPane[],
  current: AgentPane[],
): { added: AgentPane[]; removed: AgentPane[] } {
  const prevSet = new Set(previous.map((p) => p.target));
  const currSet = new Set(current.map((p) => p.target));

  const added = current.filter((p) => !prevSet.has(p.target));
  const removed = previous.filter((p) => !currSet.has(p.target));

  return { added, removed };
}
