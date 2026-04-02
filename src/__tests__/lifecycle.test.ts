import { describe, it, expect, afterEach } from "vitest";
import { readFile, writeFile, access, unlink } from "node:fs/promises";
import {
  startup,
  cleanup,
  registerSignalHandlers,
  PID_PATH,
  SOCKET_PATH,
} from "../lifecycle.js";
import type { Server } from "node:net";

let server: Server | undefined;

afterEach(async () => {
  await cleanup(server);
  server = undefined;
});

describe("startup", () => {
  it("writes PID file and binds socket on clean start", async () => {
    const result = await startup();
    server = result.server;

    const pid = await readFile(PID_PATH, "utf-8");
    expect(parseInt(pid, 10)).toBe(process.pid);

    // Socket file should exist
    await expect(access(SOCKET_PATH)).resolves.toBeUndefined();
  });

  it("cleans up stale files from dead process", async () => {
    // Write a PID that doesn't exist (99999999 is very unlikely to be alive)
    await writeFile(PID_PATH, "99999999", "utf-8");
    await writeFile(SOCKET_PATH, "", "utf-8"); // fake stale socket

    const result = await startup();
    server = result.server;

    // Should have cleaned up and started fresh
    const pid = await readFile(PID_PATH, "utf-8");
    expect(parseInt(pid, 10)).toBe(process.pid);
  });

  it("rejects when a live instance exists", async () => {
    // Write our own PID — simulates a live instance
    await writeFile(PID_PATH, String(process.pid), "utf-8");

    await expect(startup()).rejects.toThrow(/already running/);

    // Clean up manually since startup didn't complete
    await safeUnlink(PID_PATH);
  });
});

describe("cleanup", () => {
  it("removes PID and socket files", async () => {
    const result = await startup();
    server = result.server;

    await cleanup(server);
    server = undefined;

    await expect(access(PID_PATH)).rejects.toThrow();
    await expect(access(SOCKET_PATH)).rejects.toThrow();
  });

  it("does not throw when files already missing", async () => {
    // Should not throw even with no files to clean
    await expect(cleanup()).resolves.toBeUndefined();
  });
});

describe("registerSignalHandlers", () => {
  it("registers without throwing", async () => {
    const result = await startup();
    server = result.server;

    // Should not throw
    expect(() => registerSignalHandlers(result.server)).not.toThrow();
  });

  it("registers even without a server", () => {
    expect(() => registerSignalHandlers()).not.toThrow();
  });
});

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}
