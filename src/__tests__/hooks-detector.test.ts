import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectHooks } from "../hooks-detector.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
const mockedReadFile = vi.mocked(readFile);

const TEST_PATH = "/fake/.claude/settings.json";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectHooks", () => {
  it("returns false when settings.json does not exist", async () => {
    mockedReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(false);
  });

  it("returns false when settings.json has no gmux hook entries", async () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: "", hooks: [{ type: "command", command: "/other/tool.sh" }] }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(false);
  });

  it("returns false when settings.json is malformed JSON", async () => {
    mockedReadFile.mockResolvedValue("{ not valid json {{" as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(false);
  });

  it("returns true when Stop hooks contain gmux command (correct format)", async () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: "", hooks: [{ type: "command", command: "/path/to/gmux-status.sh" }] }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(true);
  });

  it("returns true when Notification hooks contain gmux command", async () => {
    const settings = {
      hooks: {
        Notification: [{ matcher: "", hooks: [{ type: "command", command: "/path/to/gmux-attention.sh" }] }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(true);
  });

  it("returns true for old broken { script } format (backward compat)", async () => {
    const settings = {
      hooks: {
        Stop: [{ script: "/path/to/gmux-status.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(true);
  });

  it("returns false when settings.json has no hooks key", async () => {
    const settings = { permissions: { allow: ["*"] } };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(false);
  });

  it("returns false when hooks object has no Stop or Notification keys", async () => {
    const settings = {
      hooks: {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "gmux-something" }] }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);
    expect(await detectHooks(TEST_PATH)).toBe(false);
  });
});
