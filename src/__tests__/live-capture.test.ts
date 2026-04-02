import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("capturePane", () => {
  it("returns stdout on success", async () => {
    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string) => void)(null, "pane output\n");
      return undefined as ReturnType<typeof execFile>;
    });

    const { capturePane } = await import("../live-capture.js");
    const result = await capturePane("mysession:0.1");

    expect(result).toBe("pane output\n");
  });

  it("returns null on error (pane gone)", async () => {
    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string) => void)(
        new Error("can't find pane"),
        "",
      );
      return undefined as ReturnType<typeof execFile>;
    });

    const { capturePane } = await import("../live-capture.js");
    const result = await capturePane("gone:0.0");

    expect(result).toBeNull();
  });

  it("passes correct tmux args including -e flag", async () => {
    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string) => void)(null, "");
      return undefined as ReturnType<typeof execFile>;
    });

    const { capturePane } = await import("../live-capture.js");
    await capturePane("work:1.0");

    expect(mockedExecFile).toHaveBeenCalledWith(
      "tmux",
      ["capture-pane", "-e", "-p", "-J", "-t", "work:1.0"],
      { timeout: 5000 },
      expect.any(Function),
    );
  });
});
