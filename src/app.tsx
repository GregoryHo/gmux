import { Box, Text, useApp, useInput } from "ink";
import type { Server } from "node:net";
import type { GmuxConfig } from "./config.js";

export interface AppProps {
  config: GmuxConfig;
  server: Server;
}

export function App({ config: _config, server: _server }: AppProps) {
  const { exit } = useApp();

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
