import type { Server, Socket } from "node:net";
import type { SocketEvent } from "./socket-types.js";

/**
 * Attach connection handling to an already-bound net.Server.
 * Each connected client sends newline-delimited JSON. Complete lines
 * are parsed and forwarded to `onEvent`. Malformed JSON is logged
 * and discarded without closing the connection.
 */
export function setupSocketServer(
  server: Server,
  onEvent: (event: SocketEvent) => void,
): void {
  server.on("connection", (socket: Socket) => {
    let buffer = "";

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");

      // Process all complete lines in the buffer
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        if (line.length === 0) {
          continue; // skip empty lines
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          console.warn("gmux: malformed JSON on socket, discarding line");
          continue;
        }

        onEvent(parsed as SocketEvent);
      }
    });

    socket.on("error", () => {
      // Client disconnected unexpectedly — nothing to do
    });
  });
}
