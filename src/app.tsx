import { useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Server } from "node:net";
import type { GmuxConfig } from "./config.js";
import { setupSocketServer } from "./socket-server.js";
import { validateEvent } from "./socket-events.js";
import type { SocketEvent } from "./socket-types.js";

export interface AppProps {
  config: GmuxConfig;
  server: Server;
}

export function App({ config: _config, server }: AppProps) {
  const { exit } = useApp();

  useEffect(() => {
    setupSocketServer(server, (raw: SocketEvent) => {
      const event = validateEvent(raw);
      if (event) {
        console.log("gmux: received event", event);
      }
    });
  }, [server]);

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "q")) {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold>gmux</Text>
        <Text> — 0 sessions</Text>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>No agent sessions detected</Text>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>Press q to quit</Text>
      </Box>
    </Box>
  );
}
