import { useState, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Server } from "node:net";
import type { GmuxConfig } from "./config.js";
import type { AgentSession } from "./types.js";
import { TmuxPoller } from "./poller.js";
import { setupSocketServer } from "./socket-server.js";
import { validateEvent } from "./socket-events.js";
import { StatusOverrideStore } from "./status-overrides.js";
import type { AgentStatus } from "./types.js";
import type { SocketEvent } from "./socket-types.js";

export interface AppProps {
  config: GmuxConfig;
  server: Server;
}

export function App({ config, server }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const pollerRef = useRef<TmuxPoller | null>(null);
  const overridesRef = useRef(new StatusOverrideStore());

  useEffect(() => {
    setupSocketServer(server, (raw: SocketEvent) => {
      const event = validateEvent(raw);
      if (!event) return;

      const target = `${event.session}:${event.pane}`;

      if (event.event === "status" && event.status) {
        overridesRef.current.set(target, event.status as AgentStatus);
      }
    });
  }, [server]);

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "q")) {
      exit();
    }
  });

  useEffect(() => {
    const poller = new TmuxPoller(config.pollInterval, overridesRef.current);
    pollerRef.current = poller;

    poller.on("update", (updated: AgentSession[]) => {
      setSessions(updated);
    });

    poller.on("error", (err: Error) => {
      // Log but don't crash — degraded mode
      console.error(`gmux: poll error: ${err.message}`);
    });

    poller.start();

    return () => {
      poller.stop();
      pollerRef.current = null;
    };
  }, [config.pollInterval]);

  const count = sessions.length;

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold>gmux</Text>
        <Text> — {count} session{count !== 1 ? "s" : ""}</Text>
      </Box>
      {count === 0 ? (
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>No agent sessions detected</Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          {sessions.map((s) => (
            <Box key={s.target} gap={2}>
              <Text>
                {s.status === "active"
                  ? "●"
                  : s.status === "idle"
                    ? "○"
                    : s.status === "needs_attention"
                      ? "⚡"
                      : "?"}
              </Text>
              <Text bold>{s.sessionName}</Text>
              <Text dimColor>{s.command}</Text>
              <Text>{s.cwd}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>Press q to quit</Text>
      </Box>
    </Box>
  );
}
