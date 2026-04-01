import type { AgentStatus } from "./types.js";

export type SocketEventType = "status" | "notify" | "meta";

/** Socket status values — excludes "unknown" which is heuristic-only. */
export type SocketAgentStatus = Exclude<AgentStatus, "unknown">;

export interface SocketEvent {
  event: SocketEventType;
  session: string;
  pane: string;
  status?: SocketAgentStatus;
  message?: string;
  model?: string;
  context_pct?: number;
}

export const VALID_EVENT_TYPES: ReadonlySet<string> = new Set([
  "status",
  "notify",
  "meta",
]);
