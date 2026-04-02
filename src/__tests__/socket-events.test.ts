import { describe, it, expect, vi, afterEach } from "vitest";
import { validateEvent } from "../socket-events.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateEvent", () => {
  it("returns typed SocketEvent for valid status event", () => {
    const raw = {
      event: "status",
      session: "my-session",
      pane: "%1",
      status: "active",
    };

    const result = validateEvent(raw);

    expect(result).toEqual(raw);
    expect(result!.event).toBe("status");
    expect(result!.session).toBe("my-session");
    expect(result!.pane).toBe("%1");
    expect(result!.status).toBe("active");
  });

  it("returns typed SocketEvent for valid notify event", () => {
    const raw = {
      event: "notify",
      session: "work",
      pane: "%3",
      message: "Task completed",
    };

    const result = validateEvent(raw);

    expect(result).toEqual(raw);
    expect(result!.event).toBe("notify");
    expect(result!.message).toBe("Task completed");
  });

  it("returns typed SocketEvent for valid meta event", () => {
    const raw = {
      event: "meta",
      session: "dev",
      pane: "%5",
      model: "opus-4",
      context_pct: 42,
    };

    const result = validateEvent(raw);

    expect(result).toEqual(raw);
    expect(result!.event).toBe("meta");
    expect(result!.model).toBe("opus-4");
    expect(result!.context_pct).toBe(42);
  });

  it("returns null for unknown event type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = validateEvent({
      event: "unknown",
      session: "s",
      pane: "p",
    });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown socket event type"),
    );
  });

  it("returns null when 'event' field is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = validateEvent({ session: "s", pane: "p" });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing 'event' field"),
    );
  });

  it("returns null when 'session' field is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = validateEvent({ event: "status", pane: "p" });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing 'session' field"),
    );
  });

  it("returns null when 'pane' field is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = validateEvent({ event: "status", session: "s" });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing 'pane' field"),
    );
  });

  it("returns null for non-object input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(validateEvent("string")).toBeNull();
    expect(validateEvent(42)).toBeNull();
    expect(validateEvent(null)).toBeNull();
    expect(validateEvent([1, 2])).toBeNull();

    expect(warn).toHaveBeenCalledTimes(4);
  });
});
