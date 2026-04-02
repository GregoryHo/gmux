import { EventEmitter } from "node:events";
import type { AgentPane, AgentSession } from "./types.js";
import { listAgentPanes, capturePaneContent } from "./tmux.js";
import { classifyStatus } from "./heuristics.js";
import { extractMetadata } from "./metadata.js";
import { StatusOverrideStore } from "./status-overrides.js";

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
export const DEGRADED_POLL_INTERVAL = 5000;

export class TmuxPoller extends EventEmitter {
  private interval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private previousTargets: Map<string, AgentSession> = new Map();
  private _sessions: AgentSession[] = [];
  private _polling = false;
  private _degraded = false;
  private _statusOverrides: StatusOverrideStore;

  constructor(pollInterval: number = 3000, statusOverrides?: StatusOverrideStore) {
    super();
    this.interval = pollInterval;
    this._statusOverrides = statusOverrides ?? new StatusOverrideStore();
  }

  /** The status override store used by this poller. */
  get statusOverrides(): StatusOverrideStore {
    return this._statusOverrides;
  }

  /** Current snapshot of all detected agent sessions. */
  get sessions(): ReadonlyArray<AgentSession> {
    return this._sessions;
  }

  /** Whether the poller is actively running. */
  get running(): boolean {
    return this.timer !== null;
  }

  /** Whether the poller is in degraded mode (tmux unreachable). */
  get degraded(): boolean {
    return this._degraded;
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
   * Restart the polling timer with a new interval.
   * Used internally to switch between normal and degraded intervals.
   */
  private restartTimer(newInterval: number): void {
    if (this.timer === null) return; // not running, nothing to restart
    clearInterval(this.timer);
    this.timer = setInterval(() => void this.poll(), newInterval);
  }

  /**
   * Execute a single poll cycle.
   * Public for testing — normally called internally by start().
   *
   * On failure, retries once after 1 second. If retry also fails,
   * enters degraded mode (polls every 5s, keeps last-known sessions).
   * On success after degraded, restores normal interval.
   */
  async poll(): Promise<void> {
    if (this._polling) return; // prevent overlapping polls
    this._polling = true;

    try {
      const panes = await listAgentPanes();
      const sessions = await this.enrichPanes(panes);
      this.diffAndEmit(sessions);
      this._sessions = sessions;

      // If we were degraded and this poll succeeded, recover
      if (this._degraded) {
        this._degraded = false;
        this.restartTimer(this.interval);
      }
    } catch (firstErr) {
      // Retry once after 1 second
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const panes = await listAgentPanes();
        const sessions = await this.enrichPanes(panes);
        this.diffAndEmit(sessions);
        this._sessions = sessions;

        // Retry succeeded — recover if degraded
        if (this._degraded) {
          this._degraded = false;
          this.restartTimer(this.interval);
        }
      } catch (retryErr) {
        // Both attempts failed — enter degraded mode
        if (!this._degraded) {
          this._degraded = true;
          this.restartTimer(DEGRADED_POLL_INTERVAL);
        }
        // Keep last-known sessions (don't clear this._sessions)
        this.emit(
          "error",
          retryErr instanceof Error ? retryErr : new Error(String(retryErr)),
        );
      }
    } finally {
      this._polling = false;
    }
  }

  /**
   * Enrich raw panes with captured content, status classification,
   * and metadata extraction.
   */
  private async enrichPanes(panes: AgentPane[]): Promise<AgentSession[]> {
    // Capture all panes in parallel — each is an independent tmux call
    const settled = await Promise.allSettled(
      panes.map(async (pane) => {
        const paneContent = await capturePaneContent(pane.target);
        const override = this._statusOverrides.get(pane.target);
        const status = override ?? classifyStatus(paneContent);
        const metadata = extractMetadata(paneContent);
        return { ...pane, status, metadata, paneContent } as AgentSession;
      }),
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<AgentSession> => r.status === "fulfilled")
      .map((r) => r.value);
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

    // Prune socket overrides for panes that no longer exist
    this._statusOverrides.pruneStale(new Set(newTargets.keys()));

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
