import { describe, it, expect, vi, afterEach } from "vitest";
import { createServer, createConnection, type Server } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { setupSocketServer } from "../socket-server.js";

/** Generate a unique temp socket path per test to avoid conflicts */
let counter = 0;
function tempSocketPath(): string {
  return join(tmpdir(), `gmux-test-${process.pid}-${++counter}.sock`);
}

/** Helper: create a server, bind it, attach socket handler, return cleanup fn */
async function createTestServer(
  onEvent: (event: unknown) => void,
): Promise<{ server: Server; socketPath: string }> {
  const socketPath = tempSocketPath();
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(socketPath, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  setupSocketServer(server, onEvent);
  return { server, socketPath };
}

/** Helper: connect a client, write data, optionally close */
function connectAndWrite(
  socketPath: string,
  data: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = createConnection(socketPath, () => {
      client.write(data, () => {
        client.end();
        resolve();
      });
    });
    client.on("error", reject);
  });
}

/** Helper: safely close a server */
async function closeServer(
  server: Server,
  socketPath: string,
): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    await unlink(socketPath);
  } catch {
    // may already be cleaned up
  }
}

describe("setupSocketServer", () => {
  const servers: Array<{ server: Server; socketPath: string }> = [];

  afterEach(async () => {
    for (const { server, socketPath } of servers) {
      await closeServer(server, socketPath);
    }
    servers.length = 0;
  });

  it("calls onEvent with parsed object for a valid JSON line", async () => {
    const onEvent = vi.fn();
    const ctx = await createTestServer(onEvent);
    servers.push(ctx);

    const payload = { event: "status", session: "s1", pane: "%1" };
    await connectAndWrite(ctx.socketPath, JSON.stringify(payload) + "\n");

    // Give the server a moment to process
    await new Promise((r) => setTimeout(r, 50));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(payload);
  });

  it("logs warning and keeps connection open on malformed JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onEvent = vi.fn();
    const ctx = await createTestServer(onEvent);
    servers.push(ctx);

    // Send malformed line followed by a valid line
    const validPayload = { event: "notify", session: "s2", pane: "%2" };
    const data =
      "not valid json\n" + JSON.stringify(validPayload) + "\n";

    await connectAndWrite(ctx.socketPath, data);
    await new Promise((r) => setTimeout(r, 50));

    // Malformed line should have been warned about
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("malformed JSON"),
    );

    // Valid line should still have been processed
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(validPayload);

    warn.mockRestore();
  });

  it("buffers partial lines until newline arrives", async () => {
    const onEvent = vi.fn();
    const ctx = await createTestServer(onEvent);
    servers.push(ctx);

    const socketPath = ctx.socketPath;
    const payload = { event: "meta", session: "s3", pane: "%3" };
    const fullLine = JSON.stringify(payload);
    const half1 = fullLine.slice(0, Math.floor(fullLine.length / 2));
    const half2 = fullLine.slice(Math.floor(fullLine.length / 2));

    await new Promise<void>((resolve, reject) => {
      const client = createConnection(socketPath, () => {
        // Send first half — no newline yet
        client.write(half1, () => {
          // Small delay, then send second half with newline
          setTimeout(() => {
            client.write(half2 + "\n", () => {
              client.end();
              resolve();
            });
          }, 30);
        });
      });
      client.on("error", reject);
    });

    await new Promise((r) => setTimeout(r, 80));

    // Event should only fire after the complete line
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(payload);
  });

  it("handles multiple events in one data chunk", async () => {
    const onEvent = vi.fn();
    const ctx = await createTestServer(onEvent);
    servers.push(ctx);

    const event1 = { event: "status", session: "s4", pane: "%4", status: "idle" };
    const event2 = { event: "notify", session: "s4", pane: "%4", message: "done" };
    const data =
      JSON.stringify(event1) + "\n" + JSON.stringify(event2) + "\n";

    await connectAndWrite(ctx.socketPath, data);
    await new Promise((r) => setTimeout(r, 50));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, event1);
    expect(onEvent).toHaveBeenNthCalledWith(2, event2);
  });
});
