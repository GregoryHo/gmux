import { describe, it, expect } from "vitest";
import { stat, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";

const HOOKS_DIR = join(import.meta.dirname, "../../hooks");

describe("hook scripts", () => {
  it("gmux-status.sh is executable", async () => {
    const info = await stat(join(HOOKS_DIR, "gmux-status.sh"));
    // Check owner execute bit (0o100)
    expect(info.mode & 0o111).toBeGreaterThan(0);
  });

  it("gmux-notify.sh is executable", async () => {
    const info = await stat(join(HOOKS_DIR, "gmux-notify.sh"));
    expect(info.mode & 0o111).toBeGreaterThan(0);
  });

  it("gmux-status.sh exits 0 when socket does not exist", async () => {
    const exitCode = await runScript(join(HOOKS_DIR, "gmux-status.sh"));
    expect(exitCode).toBe(0);
  });

  it("gmux-notify.sh exits 0 when socket does not exist", async () => {
    const exitCode = await runScript(join(HOOKS_DIR, "gmux-notify.sh"));
    expect(exitCode).toBe(0);
  });

  it("gmux-status.sh uses tmux display-message for session and pane", async () => {
    const content = await readFile(
      join(HOOKS_DIR, "gmux-status.sh"),
      "utf-8",
    );
    expect(content).toContain("tmux display-message");
    expect(content).not.toContain('SESSION="${TMUX_PANE');
  });

  it("gmux-notify.sh uses tmux display-message for session and pane", async () => {
    const content = await readFile(
      join(HOOKS_DIR, "gmux-notify.sh"),
      "utf-8",
    );
    expect(content).toContain("tmux display-message");
    expect(content).not.toContain('SESSION="${TMUX_PANE');
  });
});

function runScript(scriptPath: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      scriptPath,
      [],
      {
        // Ensure the socket path doesn't exist by using an empty env
        // that won't have a /tmp/gmux.sock
        timeout: 5000,
      },
      (_error, _stdout, _stderr) => {
        // execFile may set error.code for non-zero exits
        if (_error && _error.code !== undefined) {
          resolve(typeof _error.code === "number" ? _error.code : 1);
        } else {
          resolve(0);
        }
      },
    );
  });
}
