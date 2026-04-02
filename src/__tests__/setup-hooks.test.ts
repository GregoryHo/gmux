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

beforeEach(() => {
  vi.clearAllMocks();
  mockedMkdir.mockResolvedValue(undefined);
  mockedWriteFile.mockResolvedValue(undefined);
});

describe("setupHooks", () => {
  it("creates settings.json with Stop and Notification hook entries when file does not exist", async () => {
    mockedReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    expect(mockedWriteFile).toHaveBeenCalledOnce();
    const [writePath, writeContent] = mockedWriteFile.mock.calls[0];
    expect(writePath).toBe(TEST_SETTINGS);

    const written = JSON.parse(writeContent as string);
    expect(written.hooks.Stop).toEqual([{ script: STATUS_SCRIPT }]);
    expect(written.hooks.Notification).toEqual([{ script: ATTENTION_SCRIPT }]);
  });

  it("preserves existing settings when adding hooks", async () => {
    const existingSettings = {
      permissions: { allow: ["Bash"] },
      someOtherSetting: true,
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const [, writeContent] = mockedWriteFile.mock.calls[0];
    const written = JSON.parse(writeContent as string);

    expect(written.permissions).toEqual({ allow: ["Bash"] });
    expect(written.someOtherSetting).toBe(true);
    expect(written.hooks.Stop).toEqual([{ script: STATUS_SCRIPT }]);
    expect(written.hooks.Notification).toEqual([{ script: ATTENTION_SCRIPT }]);
  });

  it("is idempotent — running twice does not duplicate entries", async () => {
    const existingSettings = {
      hooks: {
        Stop: [{ script: STATUS_SCRIPT }],
        Notification: [{ script: ATTENTION_SCRIPT }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const [, writeContent] = mockedWriteFile.mock.calls[0];
    const written = JSON.parse(writeContent as string);

    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(1);
    expect(written.hooks.Stop[0].script).toBe(STATUS_SCRIPT);
    expect(written.hooks.Notification[0].script).toBe(ATTENTION_SCRIPT);
  });

  it("preserves other hook entries when adding gmux hooks", async () => {
    const existingSettings = {
      hooks: {
        Stop: [{ script: "/other/tool.sh" }],
        Notification: [{ script: "/other/notify.sh" }],
      },
    };
    mockedReadFile.mockResolvedValue(JSON.stringify(existingSettings) as unknown as Buffer);

    await setupHooks(HOOKS_DIR, TEST_SETTINGS);

    const [, writeContent] = mockedWriteFile.mock.calls[0];
    const written = JSON.parse(writeContent as string);

    expect(written.hooks.Stop).toHaveLength(2);
    expect(written.hooks.Stop).toContainEqual({ script: "/other/tool.sh" });
    expect(written.hooks.Stop).toContainEqual({ script: STATUS_SCRIPT });

    expect(written.hooks.Notification).toHaveLength(2);
    expect(written.hooks.Notification).toContainEqual({ script: "/other/notify.sh" });
    expect(written.hooks.Notification).toContainEqual({ script: ATTENTION_SCRIPT });
  });

  it("throws when writeFile fails", async () => {
    mockedReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    mockedWriteFile.mockRejectedValue(new Error("EACCES: permission denied"));

    await expect(setupHooks(HOOKS_DIR, TEST_SETTINGS)).rejects.toThrow("EACCES: permission denied");
  });
});
