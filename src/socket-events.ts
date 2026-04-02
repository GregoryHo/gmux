import { VALID_EVENT_TYPES, type SocketEvent } from "./socket-types.js";

/**
 * Validate a raw parsed JSON value as a SocketEvent.
 * Returns null (with a console.warn) if the data is invalid.
 */
export function validateEvent(raw: unknown): SocketEvent | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    console.warn("gmux: socket event is not an object, discarding");
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Check required fields
  if (typeof obj.event !== "string") {
    console.warn("gmux: socket event missing 'event' field, discarding");
    return null;
  }

  if (!VALID_EVENT_TYPES.has(obj.event)) {
    console.warn(
      `gmux: unknown socket event type '${obj.event}', discarding`,
    );
    return null;
  }

  if (typeof obj.session !== "string") {
    console.warn("gmux: socket event missing 'session' field, discarding");
    return null;
  }

  if (typeof obj.pane !== "string") {
    console.warn("gmux: socket event missing 'pane' field, discarding");
    return null;
  }

  return obj as unknown as SocketEvent;
}
