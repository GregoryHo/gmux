import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupHooks } from "../setup-hooks.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);

const TEST_SETTINGS = "/fake/.claude/settings.json";
const HOOKS_DIR = "/usr/local/lib/gmux/hooks";
const STATUS_SCRIPT = `${HOOKS_DIR}/gmux-status.sh`;
const ATTENTION_SCRIPT = `${HOOKS_DIR}/gmux-attention.sh`;

function makeExpectedRule(script: string) {
  return { matcher: "", hooks: [{ type: "command", command: script }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedMkdir.mockResolvedValue(undefined);
  mockedWriteFile.mockResolvedValue(undefined);
});

describe("setupHooks", () => {
  it("creates settings.json with correct hook format when file does not exist", async () => {
    mockedReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    expect(mockedWriteFile).toHaveBeenCalledOnce();
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
    expect(written.hooks.Stop).toEqual([makeExpectedRule(STATUS_SCRIPT)]);
    expect(written.hooks.Notification).toEqual([makeExpectedRule(ATTENTION_SCRIPT)]);
  });

  it("preserves existing settings when adding hooks", async () => {
    const existingSettings = {
      permissions: { allow: ["Bash"] },
      someOtherSetting: true,
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
    expect(written.permissions).toEqual({ allow: ["Bash"] });
    expect(written.someOtherSetting).toBe(true);
    expect(written.hooks.Stop).toEqual([makeExpectedRule(STATUS_SCRIPT)]);
    expect(written.hooks.Notification).toEqual([makeExpectedRule(ATTENTION_SCRIPT)]);
  });

  it("is idempotent — running twice does not duplicate entries", async () => {
    const existingSettings = {
      hooks: {
        Stop: [makeExpectedRule(STATUS_SCRIPT)],
        Notification: [makeExpectedRule(ATTENTION_SCRIPT)],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(1);
  });

  it("cleans up old broken { script } format and replaces with correct format", async () => {
    const existingSettings = {
      hooks: {
        Stop: [{ script: "/old/path/gmux-status.sh" }],
        Notification: [{ script: "/old/path/gmux-attention.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
    // Old entries removed, new correct entries added
    expect(written.hooks.Stop).toEqual([makeExpectedRule(STATUS_SCRIPT)]);
    expect(written.hooks.Notification).toEqual([makeExpectedRule(ATTENTION_SCRIPT)]);
  });

  it("preserves other hook entries when adding gmux hooks", async () => {
    const existingSettings = {
      hooks: {
        Stop: [{ matcher: "", hooks: [{ type: "command", command: "/other/tool.sh" }] }],
        Notification: [{ matcher: "idle_prompt", hooks: [{ type: "command", command: "/other/notify.sh" }] }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
    expect(written.hooks.Stop).toHaveLength(2);
    expect(written.hooks.Notification).toHaveLength(2);
  });

  it("throws when writeFile fails", async () => {
    mockedReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    mockedWriteFile.mockRejectedValue(new Error("EACCES: permission denied"));

    await expect(setupHooks(HOOKS_DIR, TEST_SETTINGS)).rejects.toThrow("EACCES: permission denied");
  });
});
