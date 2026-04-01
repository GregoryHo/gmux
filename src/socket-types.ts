export type SocketEventType = "status" | "notify" | "meta";

export type AgentStatus = "idle" | "active" | "needs_attention";

export interface SocketEvent {
  event: SocketEventType;
  session: string;
  pane: string;
  /** Present on 'status' events */
  status?: AgentStatus;
  /** Present on 'notify' events */
  message?: string;
  /** Present on 'meta' events */
  model?: string;
  /** Present on 'meta' events — context window usage percentage */
  context_pct?: number;
}

export const VALID_EVENT_TYPES: ReadonlySet<string> = new Set([
  "status",
  "notify",
  "meta",
]);
