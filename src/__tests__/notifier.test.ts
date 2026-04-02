import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Notifier, sendMacOSNotification } from "../notifier.js";
import type { GmuxConfig } from "../config.js";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);

function makeConfig(overrides?: Partial<GmuxConfig>): GmuxConfig {
  return {
    pollInterval: 3000,
    notificationCooldown: 300_000,
    sound: false,
    ...overrides,
  };
}

describe("sendMacOSNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds correct osascript command without sound", async () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    await sendMacOSNotification("gmux", "hello world", false);

    expect(mockedExecFile).toHaveBeenCalledWith(
      "osascript",
      ["-e", 'display notification "hello world" with title "gmux"'],
      expect.any(Function),
    );
  });

  it("includes sound name when sound=true", async () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    await sendMacOSNotification("gmux", "alert", true);

    expect(mockedExecFile).toHaveBeenCalledWith(
      "osascript",
      [
        "-e",
        'display notification "alert" with title "gmux" sound name "default"',
      ],
      expect.any(Function),
    );
  });

  it("omits sound name when sound=false", async () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    await sendMacOSNotification("gmux", "quiet", false);

    const args = mockedExecFile.mock.calls[0][1] as string[];
    expect(args[1]).not.toContain("sound name");
  });

  it("catches and logs errors without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(new Error("osascript not found"));
      return undefined as ReturnType<typeof execFile>;
    });

    // Should not throw
    await expect(
      sendMacOSNotification("gmux", "test", false),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("macOS notification failed"),
    );

    warn.mockRestore();
  });
});

describe("Notifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends notification via sendMacOSNotification", () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    const notifier = new Notifier(makeConfig());
    notifier.notify("myapp", "finished");

    expect(mockedExecFile).toHaveBeenCalledWith(
      "osascript",
      ["-e", 'display notification "[myapp] finished" with title "gmux"'],
      expect.any(Function),
    );
  });

  it("suppresses second call within cooldown window", () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    const notifier = new Notifier(makeConfig({ notificationCooldown: 300_000 }));

    notifier.notify("myapp", "finished");
    expect(mockedExecFile).toHaveBeenCalledTimes(1);

    // Advance less than cooldown
    vi.advanceTimersByTime(60_000);
    notifier.notify("myapp", "needs input");
    expect(mockedExecFile).toHaveBeenCalledTimes(1); // Still 1 — suppressed
  });

  it("allows notification after cooldown expires", () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    const notifier = new Notifier(makeConfig({ notificationCooldown: 300_000 }));

    notifier.notify("myapp", "finished");
    expect(mockedExecFile).toHaveBeenCalledTimes(1);

    // Advance past cooldown
    vi.advanceTimersByTime(300_001);
    notifier.notify("myapp", "needs input");
    expect(mockedExecFile).toHaveBeenCalledTimes(2);
  });

  it("cooldown is per-session — different sessions do not share cooldown", () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    const notifier = new Notifier(makeConfig({ notificationCooldown: 300_000 }));

    notifier.notify("sessionA", "finished");
    expect(mockedExecFile).toHaveBeenCalledTimes(1);

    // Same timestamp — sessionB should still go through
    notifier.notify("sessionB", "finished");
    expect(mockedExecFile).toHaveBeenCalledTimes(2);

    // sessionA within cooldown — suppressed
    notifier.notify("sessionA", "needs input");
    expect(mockedExecFile).toHaveBeenCalledTimes(2);
  });

  it("respects sound config", () => {
    mockedExecFile.mockImplementation((_cmd, _args, cb) => {
      (cb as (err: Error | null) => void)(null);
      return undefined as ReturnType<typeof execFile>;
    });

    const notifier = new Notifier(makeConfig({ sound: true }));
    notifier.notify("myapp", "done");

    const args = mockedExecFile.mock.calls[0][1] as string[];
    expect(args[1]).toContain('sound name "default"');
  });
});
