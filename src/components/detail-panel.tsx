import { Box, Text } from "ink";
import type { AgentSession } from "../types.js";

export interface DetailPanelProps {
  session: AgentSession | null;
}

/**
 * DetailPanel shows extended info for the currently selected session.
 * Displays target, agent version, model, context usage, and last output snippet.
 */
export function DetailPanel({ session }: DetailPanelProps) {
  if (!session) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No agent sessions detected</Text>
      </Box>
    );
  }

  const { target, command, metadata } = session;
  const parts: string[] = [target];

  if (command) {
    parts.push(`Claude ${command}`);
  }

  if (metadata.model) {
    parts.push(metadata.model);
  }

  if (metadata.contextPct !== null) {
    parts.push(`${metadata.contextPct}% ctx`);
  }

  const infoLine = parts.join(" \u00B7 "); // middle dot separator

  // Truncate last output to a single line, ~80 chars
  let lastOutput: string | null = null;
  if (metadata.lastOutput) {
    const firstLine = metadata.lastOutput.split("\n")[0] ?? "";
    lastOutput =
      firstLine.length > 80 ? firstLine.slice(0, 77) + "..." : firstLine;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>{infoLine}</Text>
      {lastOutput ? (
        <Text dimColor>Last: &quot;{lastOutput}&quot;</Text>
      ) : null}
    </Box>
  );
}
