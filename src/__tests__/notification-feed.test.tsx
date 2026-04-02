import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import {
  NotificationFeed,
  createNotification,
  addNotification,
  formatRelativeTime,
  MAX_EVENTS,
} from "../components/notification-feed.js";
import type { NotificationEvent } from "../components/notification-feed.js";

describe("NotificationFeed", () => {
  it("renders nothing when no events", () => {
    const { lastFrame } = render(
      <NotificationFeed events={[]} />,
    );
    // When component returns null, lastFrame is empty string
    expect(lastFrame()).toBe("");
  });

  it("renders events with icon, name, message", () => {
    const events: NotificationEvent[] = [
      { id: 1, sessionName: "arcforge", message: "session started", timestamp: Date.now() },
      { id: 2, sessionName: "workspace", message: "finished", timestamp: Date.now() },
    ];

    const { lastFrame } = render(
      <NotificationFeed events={events} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("⚡");
    expect(frame).toContain("arcforge");
    expect(frame).toContain("session started");
    expect(frame).toContain("workspace");
    expect(frame).toContain("finished");
  });

  it("shows events newest first (preserves input order)", () => {
    const events: NotificationEvent[] = [
      { id: 2, sessionName: "newest", message: "added", timestamp: Date.now() },
      { id: 1, sessionName: "oldest", message: "added", timestamp: Date.now() - 60000 },
    ];

    const { lastFrame } = render(
      <NotificationFeed events={events} />,
    );
    const frame = lastFrame()!;
    const newestIdx = frame.indexOf("newest");
    const oldestIdx = frame.indexOf("oldest");
    expect(newestIdx).toBeLessThan(oldestIdx);
  });

  it("limits display to maxDisplay", () => {
    const events: NotificationEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      sessionName: `session-${i}`,
      message: "event",
      timestamp: Date.now(),
    }));

    const { lastFrame } = render(
      <NotificationFeed events={events} maxDisplay={3} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("session-0");
    expect(frame).toContain("session-1");
    expect(frame).toContain("session-2");
    expect(frame).not.toContain("session-3");
  });

  it("shows relative timestamps", () => {
    const events: NotificationEvent[] = [
      { id: 1, sessionName: "test", message: "msg", timestamp: Date.now() - 5000 },
    ];

    const { lastFrame } = render(
      <NotificationFeed events={events} />,
    );
    expect(lastFrame()).toContain("just now");
  });
});

describe("formatRelativeTime", () => {
  const now = 1700000000000;

  it("shows 'just now' for < 60s", () => {
    expect(formatRelativeTime(now - 30000, now)).toBe("just now");
  });

  it("shows minutes for < 1h", () => {
    expect(formatRelativeTime(now - 120000, now)).toBe("2m ago");
  });

  it("shows hours for < 1d", () => {
    expect(formatRelativeTime(now - 7200000, now)).toBe("2h ago");
  });

  it("shows days for >= 1d", () => {
    expect(formatRelativeTime(now - 172800000, now)).toBe("2d ago");
  });
});

describe("createNotification", () => {
  it("creates event with name and message", () => {
    const event = createNotification("myapp", "session started");
    expect(event.sessionName).toBe("myapp");
    expect(event.message).toBe("session started");
    expect(event.id).toBeGreaterThan(0);
    expect(event.timestamp).toBeGreaterThan(0);
  });
});

describe("addNotification", () => {
  it("prepends new event", () => {
    const existing: NotificationEvent[] = [
      { id: 1, sessionName: "old", message: "msg", timestamp: 100 },
    ];
    const newEvent = createNotification("new", "added");
    const result = addNotification(existing, newEvent);
    expect(result[0].sessionName).toBe("new");
    expect(result[1].sessionName).toBe("old");
  });

  it("caps at MAX_EVENTS", () => {
    const existing: NotificationEvent[] = Array.from(
      { length: MAX_EVENTS },
      (_, i) => ({
        id: i,
        sessionName: `s${i}`,
        message: "msg",
        timestamp: Date.now(),
      }),
    );
    const newEvent = createNotification("overflow", "msg");
    const result = addNotification(existing, newEvent);
    expect(result.length).toBe(MAX_EVENTS);
    expect(result[0].sessionName).toBe("overflow");
  });
});

describe("NotificationFeed with maxHeight", () => {
  it("limits displayed events to maxHeight", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createNotification(`session${i}`, `event ${i}`),
    );
    const { lastFrame } = render(
      <NotificationFeed events={events} maxHeight={3} />,
    );
    const output = lastFrame() ?? "";
    const lines = output.split("\n").filter((l) => l.includes("⚡"));
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("uses maxDisplay when maxHeight is not set", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createNotification(`session${i}`, `event ${i}`),
    );
    const { lastFrame } = render(
      <NotificationFeed events={events} maxDisplay={4} />,
    );
    const output = lastFrame() ?? "";
    const lines = output.split("\n").filter((l) => l.includes("⚡"));
    expect(lines.length).toBeLessThanOrEqual(4);
  });
});
