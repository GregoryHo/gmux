import { Box, Text } from "ink";

/** A single notification event entry. */
export interface NotificationEvent {
  /** Unique id for React key */
  id: number;
  /** Session name or target involved */
  sessionName: string;
  /** Human-readable message */
  message: string;
  /** Timestamp when the event occurred */
  timestamp: number;
}

export interface NotificationFeedProps {
  events: NotificationEvent[];
  /** Maximum events to display. Defaults to 5. */
  maxDisplay?: number;
}

/** Maximum number of events to keep in the store. */
export const MAX_EVENTS = 50;

let nextId = 1;

/** Create a new notification event. */
export function createNotification(
  sessionName: string,
  message: string,
): NotificationEvent {
  return {
    id: nextId++,
    sessionName,
    message,
    timestamp: Date.now(),
  };
}

/**
 * Add a notification to an events array, keeping within MAX_EVENTS limit.
 * Returns a new array (immutable).
 */
export function addNotification(
  events: NotificationEvent[],
  event: NotificationEvent,
): NotificationEvent[] {
  const updated = [event, ...events];
  if (updated.length > MAX_EVENTS) {
    return updated.slice(0, MAX_EVENTS);
  }
  return updated;
}

/**
 * Format a timestamp as a relative time string ("2m ago", "1h ago", etc.).
 */
export function formatRelativeTime(timestamp: number, now?: number): string {
  const elapsed = ((now ?? Date.now()) - timestamp) / 1000;

  if (elapsed < 60) return "just now";
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
  return `${Math.floor(elapsed / 86400)}d ago`;
}

/**
 * NotificationFeed component — shows recent events in reverse chronological order.
 */
export function NotificationFeed({
  events,
  maxDisplay = 5,
}: NotificationFeedProps) {
  if (events.length === 0) {
    return null;
  }

  const displayed = events.slice(0, maxDisplay);

  return (
    <Box flexDirection="column" paddingX={1}>
      {displayed.map((event) => (
        <Box key={event.id} gap={1}>
          <Text>⚡</Text>
          <Text bold>{event.sessionName}</Text>
          <Text>{event.message}</Text>
          <Text dimColor>— {formatRelativeTime(event.timestamp)}</Text>
        </Box>
      ))}
    </Box>
  );
}
