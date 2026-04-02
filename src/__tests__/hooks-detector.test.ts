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
        Stop: [{ script: "/usr/local/bin/some-other-script.sh" }],
        Notification: [{ script: "/usr/local/bin/another-script.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(false);
  });

  it("returns false when settings.json is malformed JSON", async () => {
    mockedReadFile.mockResolvedValue("{ not valid json {{" as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(false);
  });

  it("returns true when Stop hooks contain a gmux reference", async () => {
    const settings = {
      hooks: {
        Stop: [{ script: "/usr/local/bin/gmux-status.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(true);
  });

  it("returns true when Notification hooks contain a gmux reference", async () => {
    const settings = {
      hooks: {
        Notification: [{ script: "/usr/local/bin/gmux-attention.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(true);
  });

  it("returns true when both Stop and Notification hooks reference gmux", async () => {
    const settings = {
      hooks: {
        Stop: [{ script: "/home/user/.local/bin/gmux-status.sh" }],
        Notification: [{ script: "/home/user/.local/bin/gmux-attention.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(true);
  });

  it("returns false when settings.json has no hooks key", async () => {
    const settings = { permissions: { allow: ["*"] } };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(false);
  });

  it("returns false when hooks object has no Stop or Notification keys", async () => {
    const settings = {
      hooks: {
        PreToolUse: [{ script: "/usr/local/bin/gmux-something.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(settings) as unknown as Buffer);

    const result = await detectHooks(TEST_PATH);
    expect(result).toBe(false);
  });
});
