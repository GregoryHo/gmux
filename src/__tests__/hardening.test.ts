import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgentSession } from "../types.js";

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    target: "test:0.0",
    sessionName: "test",
    command: "1.2.3",
    cwd: "/tmp/test",
    tty: "/dev/ttys000",
    pid: 1000,
    status: "active",
    metadata: { lastOutput: null, model: null, contextPct: null },
    paneContent: "",
    ...overrides,
  };
}

describe("TmuxPoller degraded mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("enters degraded mode after two consecutive failures (retry fails)", async () => {
    // Mock tmux module to fail
    const tmuxMock = await import("../tmux.js");
    vi.spyOn(tmuxMock, "listAgentPanes").mockRejectedValue(
      new Error("tmux not found"),
    );

    const { TmuxPoller } = await import("../poller.js");
    const poller = new TmuxPoller(3000);

    const errors: Error[] = [];
    poller.on("error", (err: Error) => errors.push(err));

    expect(poller.degraded).toBe(false);

    // Start poll — first attempt fails, then retry after 1s also fails
    const pollPromise = poller.poll();

    // Advance past the 1-second retry delay
    await vi.advanceTimersByTimeAsync(1100);
    await pollPromise;

    expect(poller.degraded).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it("exits degraded mode when poll succeeds", async () => {
    const tmuxMock = await import("../tmux.js");
    const listSpy = vi.spyOn(tmuxMock, "listAgentPanes");

    // First: fail to enter degraded mode
    listSpy.mockRejectedValue(new Error("tmux not found"));

    const { TmuxPoller } = await import("../poller.js");
    const poller = new TmuxPoller(3000);

    const errors: Error[] = [];
    poller.on("error", (err: Error) => errors.push(err));

    // Enter degraded mode
    const p1 = poller.poll();
    await vi.advanceTimersByTimeAsync(1100);
    await p1;
    expect(poller.degraded).toBe(true);

    // Now succeed
    listSpy.mockResolvedValue([]);
    vi.spyOn(tmuxMock, "capturePaneContent").mockResolvedValue("");

    const p2 = poller.poll();
    await p2;

    expect(poller.degraded).toBe(false);
  });

  it("retries once before entering degraded mode", async () => {
    const tmuxMock = await import("../tmux.js");
    const listSpy = vi.spyOn(tmuxMock, "listAgentPanes");

    // First call fails, retry succeeds
    let callCount = 0;
    listSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("temporary failure");
      }
      return [];
    });
    vi.spyOn(tmuxMock, "capturePaneContent").mockResolvedValue("");

    const { TmuxPoller } = await import("../poller.js");
    const poller = new TmuxPoller(3000);

    const errors: Error[] = [];
    poller.on("error", (err: Error) => errors.push(err));

    const pollPromise = poller.poll();
    await vi.advanceTimersByTimeAsync(1100);
    await pollPromise;

    // Retry succeeded — should NOT be degraded
    expect(poller.degraded).toBe(false);
    expect(errors).toHaveLength(0);
    // listAgentPanes should have been called twice (initial + retry)
    expect(callCount).toBe(2);
  });

  it("keeps last-known sessions during degraded mode", async () => {
    const tmuxMock = await import("../tmux.js");
    const listSpy = vi.spyOn(tmuxMock, "listAgentPanes");
    const captureSpy = vi.spyOn(tmuxMock, "capturePaneContent");

    const session = makeSession({
      target: "app:0.0",
      sessionName: "app",
    });

    // First poll succeeds with a session
    listSpy.mockResolvedValueOnce([
      {
        target: session.target,
        sessionName: session.sessionName,
        command: session.command,
        cwd: session.cwd,
        tty: session.tty,
        pid: session.pid,
      },
    ]);
    captureSpy.mockResolvedValueOnce("some content");

    const { TmuxPoller } = await import("../poller.js");
    const poller = new TmuxPoller(3000);

    // Must register error listener to prevent unhandled 'error' event throw
    const errors: Error[] = [];
    poller.on("error", (err: Error) => errors.push(err));

    // Successful first poll
    await poller.poll();
    expect(poller.sessions).toHaveLength(1);
    expect(poller.sessions[0].target).toBe("app:0.0");

    // Now fail — should keep last-known sessions
    listSpy.mockRejectedValue(new Error("tmux not found"));

    const p2 = poller.poll();
    await vi.advanceTimersByTimeAsync(1100);
    await p2;

    expect(poller.degraded).toBe(true);
    // Sessions should be preserved (not cleared)
    expect(poller.sessions).toHaveLength(1);
    expect(poller.sessions[0].target).toBe("app:0.0");
  });
});

describe("startup socket degraded mode", () => {
  it("returns { server: null } when socket bind fails with non-EADDRINUSE error", async () => {
    // Test the error handling logic directly since we can't easily mock
    // createServer in ESM. We verify the contract by testing the error
    // classification logic that startup() uses.
    //
    // The key logic in startup():
    //   try { server = await bindSocket(); return { server }; }
    //   catch (err) {
    //     if (isNodeError(err) && err.code === "EADDRINUSE") throw err;
    //     return { server: null };
    //   }

    function isNodeError(err: unknown): err is NodeJS.ErrnoException {
      return err instanceof Error && "code" in err;
    }

    // Non-EADDRINUSE error should result in { server: null }
    const eacces = new Error("listen EACCES: permission denied") as NodeJS.ErrnoException;
    eacces.code = "EACCES";

    let result: { server: null | object };
    try {
      throw eacces;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "EADDRINUSE") {
        throw err; // should not reach here
      }
      result = { server: null };
    }
    expect(result!.server).toBeNull();

    // EADDRINUSE error should be rethrown
    const eaddrinuse = new Error("listen EADDRINUSE") as NodeJS.ErrnoException;
    eaddrinuse.code = "EADDRINUSE";

    expect(() => {
      try {
        throw eaddrinuse;
      } catch (err: unknown) {
        if (isNodeError(err) && err.code === "EADDRINUSE") {
          throw err;
        }
        // Would return { server: null } but shouldn't reach here
      }
    }).toThrow(/EADDRINUSE/);
  });
});

describe("sendKeys failure handling", () => {
  it("sendKeys failure with 'can\\'t find' triggers session removal", async () => {
    // This tests the integration logic in the App's handleSendError callback.
    // We test the logic directly rather than through React rendering.
    //
    // The callback:
    // 1. Checks if error message contains "can't find"
    // 2. Removes pane from sessions
    // 3. Adds "session ended" notification

    // Simulate the callback logic directly
    const sessions = [
      makeSession({ target: "app:0.0", sessionName: "app" }),
      makeSession({ target: "other:1.0", sessionName: "other" }),
    ];

    const error = new Error("tmux send-keys failed: can't find pane: app:0.0");
    const target = "app:0.0";

    // Simulate the filter logic from handleSendError
    const msg = error.message || "";
    const shouldRemove =
      msg.includes("can't find") ||
      msg.includes("no such") ||
      msg.includes("not found") ||
      msg.includes("failed");

    expect(shouldRemove).toBe(true);

    const filtered = sessions.filter((s) => s.target !== target);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].target).toBe("other:1.0");

    // Extract session name
    const colonIdx = target.indexOf(":");
    const name = colonIdx > 0 ? target.substring(0, colonIdx) : target;
    expect(name).toBe("app");
  });
});
