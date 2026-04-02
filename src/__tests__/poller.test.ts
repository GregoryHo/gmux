import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeDiff } from "../poller.js";
import type { AgentPane } from "../types.js";

function makePane(overrides: Partial<AgentPane> = {}): AgentPane {
  return {
    target: "test:0.0",
    sessionName: "test",
    command: "1.2.3",
    cwd: "/tmp/test",
    tty: "/dev/ttys000",
    pid: 1000,
    ...overrides,
  };
}

describe("computeDiff", () => {
  it("detects added panes", () => {
    const previous: AgentPane[] = [];
    const current = [makePane({ target: "new:0.0", sessionName: "new" })];

    const diff = computeDiff(previous, current);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].target).toBe("new:0.0");
    expect(diff.removed).toHaveLength(0);
  });

  it("detects removed panes", () => {
    const previous = [makePane({ target: "old:0.0", sessionName: "old" })];
    const current: AgentPane[] = [];

    const diff = computeDiff(previous, current);

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].target).toBe("old:0.0");
    expect(diff.added).toHaveLength(0);
  });

  it("detects both additions and removals", () => {
    const previous = [
      makePane({ target: "stays:0.0", sessionName: "stays" }),
      makePane({ target: "leaves:1.0", sessionName: "leaves" }),
    ];
    const current = [
      makePane({ target: "stays:0.0", sessionName: "stays" }),
      makePane({ target: "arrives:2.0", sessionName: "arrives" }),
    ];

    const diff = computeDiff(previous, current);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].target).toBe("arrives:2.0");
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].target).toBe("leaves:1.0");
  });

  it("reports no changes for identical lists", () => {
    const panes = [
      makePane({ target: "a:0.0", sessionName: "a" }),
      makePane({ target: "b:1.0", sessionName: "b" }),
    ];

    const diff = computeDiff(panes, [...panes]);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("handles empty to empty", () => {
    const diff = computeDiff([], []);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("handles multiple additions at once", () => {
    const current = [
      makePane({ target: "a:0.0", sessionName: "a" }),
      makePane({ target: "b:1.0", sessionName: "b" }),
      makePane({ target: "c:2.0", sessionName: "c" }),
    ];

    const diff = computeDiff([], current);

    expect(diff.added).toHaveLength(3);
    expect(diff.removed).toHaveLength(0);
  });

  it("handles multiple removals at once", () => {
    const previous = [
      makePane({ target: "a:0.0", sessionName: "a" }),
      makePane({ target: "b:1.0", sessionName: "b" }),
    ];

    const diff = computeDiff(previous, []);

    expect(diff.removed).toHaveLength(2);
    expect(diff.added).toHaveLength(0);
  });
});

describe("TmuxPoller", () => {
  // We test the poller's event emission by mocking the tmux module
  // Since TmuxPoller imports from tmux.ts which calls execFile,
  // we mock the underlying functions.

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("can be constructed with custom interval", async () => {
    // Dynamic import to allow mocking
    const { TmuxPoller } = await import("../poller.js");
    const poller = new TmuxPoller(5000);
    expect(poller.running).toBe(false);
    expect(poller.sessions).toEqual([]);
  });

  it("stop is safe to call when not running", async () => {
    const { TmuxPoller } = await import("../poller.js");
    const poller = new TmuxPoller();
    // Should not throw
    poller.stop();
    expect(poller.running).toBe(false);
  });
});
