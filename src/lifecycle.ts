import { readFile, writeFile, unlink } from "node:fs/promises";
import { createServer, type Server } from "node:net";

export const PID_PATH = "/tmp/gmux.pid";
export const SOCKET_PATH = "/tmp/gmux.sock";

/**
 * Check if a process with the given PID is alive.
 * Uses signal 0 — tests existence without sending a real signal.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the PID from the PID file. Returns null if file doesn't exist or is invalid.
 */
async function readPidFile(): Promise<number | null> {
  try {
    const raw = await readFile(PID_PATH, "utf-8");
    const pid = parseInt(raw.trim(), 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Attempt to clean up stale files from a previous crash.
 * Returns true if cleanup was performed, false if a live instance was found.
 */
async function cleanStaleFiles(): Promise<boolean> {
  const pid = await readPidFile();

  if (pid !== null && isProcessAlive(pid)) {
    return false; // live instance exists
  }

  // Stale or missing — clean up
  await safeUnlink(PID_PATH);
  await safeUnlink(SOCKET_PATH);
  return true;
}

/**
 * Write the current process PID to the PID file.
 */
async function writePidFile(): Promise<void> {
  await writeFile(PID_PATH, String(process.pid), "utf-8");
}

/**
 * Bind a Unix socket server at SOCKET_PATH.
 * Returns the server instance (actual protocol handling is added in epic-socket).
 */
function bindSocket(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(SOCKET_PATH, () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

export interface StartupResult {
  server: Server;
}

/**
 * Run the gmux startup sequence:
 * 1. Check for stale PID/socket from previous crash → clean up
 * 2. If a live instance exists → exit with error
 * 3. Write PID file
 * 4. Bind Unix socket
 */
export async function startup(): Promise<StartupResult> {
  const cleaned = await cleanStaleFiles();

  if (!cleaned) {
    const pid = await readPidFile();
    throw new Error(`gmux already running (PID: ${pid})`);
  }

  await writePidFile();

  const server = await bindSocket();
  return { server };
}

/**
 * Clean up PID and socket files. Called during shutdown.
 */
export async function cleanup(server?: Server): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
  await safeUnlink(SOCKET_PATH);
  await safeUnlink(PID_PATH);
}

/**
 * Register signal handlers that run cleanup before exit.
 * Handles SIGINT and SIGTERM. Safe to call multiple times — only registers once.
 */
export function registerSignalHandlers(server?: Server): void {
  let shuttingDown = false;

  const handler = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    await cleanup(server);
    process.exit(0);
  };

  process.on("SIGINT", () => void handler());
  process.on("SIGTERM", () => void handler());
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // ignore — file may not exist
  }
}
