import { Box, Text } from "ink";

export interface HeaderProps {
  sessionCount: number;
  activeCount: number;
  degraded: boolean;
  socketAvailable: boolean;
  hooksConfigured?: boolean;
  focusSession?: string;
}

export function Header({ sessionCount, activeCount, degraded, socketAvailable, hooksConfigured, focusSession }: HeaderProps) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const hasWarning = degraded || !socketAvailable || hooksConfigured === false;

  if (focusSession) {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text bold color={hasWarning ? "yellow" : undefined}>gmux</Text>
          <Text>— {focusSession} · Full Transcript</Text>
        </Box>
        <Text dimColor>Esc ←</Text>
      </Box>
    );
  }

  let warningText = "";
  if (degraded) warningText = "⚠ tmux";
  else if (!socketAvailable) warningText = "⚠ socket";
  else if (hooksConfigured === false) warningText = "⚠ hooks";

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text bold color={hasWarning ? "yellow" : undefined}>gmux</Text>
        <Text color={hasWarning ? "yellow" : undefined}>
          — {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          {activeCount > 0 ? ` · ${activeCount} active` : ""}
        </Text>
        {warningText ? <Text color="yellow" bold>{warningText}</Text> : null}
      </Box>
      <Text dimColor>{timeStr}</Text>
    </Box>
  );
}
