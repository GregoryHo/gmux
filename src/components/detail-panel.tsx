import { Box, Text } from "ink";
import type { AgentSession } from "../types.js";
import type { ConversationEntry } from "../jsonl-reader.js";
import { AnsiText } from "../ansi-renderer.js";
import { parseAnsiSequences } from "ansi-sequence-parser";

export interface DetailPanelProps {
  session: AgentSession | null;
  source: "live" | "conv";
  frozen: boolean;
  /** Live terminal content for LIVE mode. */
  liveContent?: string;
  /** Recent conversation entries from JSONL (CONV mode). */
  conversation?: ConversationEntry[];
  /** Scroll offset (lines from top when frozen). */
  scrollOffset?: number;
  /** Visible lines in the panel. */
  visibleLines?: number;
  /** Terminal width for text wrapping. */
  terminalWidth?: number;
  /** Source pane width (for ratio indicator when wider than panel). */
  sourcePaneWidth?: number | null;
  /** Whether the tmux pane is still alive. */
  paneAlive?: boolean;
}

/**
 * Returns the mode indicator string for the current source/frozen state.
 */
function modeIndicator(source: "live" | "conv", frozen: boolean): string {
  const label = source === "live" ? "LIVE" : "CONV";
  return frozen ? `[${label} ⏸]` : `[${label}]`;
}

/**
 * Truncate text to fit within a line budget.
 * Keeps the first N lines, truncating the last one if needed.
 */
function fitText(text: string, maxLines: number, lineWidth: number): string {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    // Estimate wrapped lines for this raw line
    const wrappedCount = Math.max(1, Math.ceil(raw.length / lineWidth));
    if (lines.length + wrappedCount > maxLines) {
      // Truncate this line to fit remaining budget
      const remaining = maxLines - lines.length;
      if (remaining > 0) {
        lines.push(raw.slice(0, remaining * lineWidth - 3) + "...");
      }
      break;
    }
    lines.push(raw);
  }
  return lines.join("\n") || text.slice(0, lineWidth - 3) + "...";
}

function MetadataHeader({
  session,
  source,
  frozen,
  sourcePaneWidth,
  panelWidth,
}: {
  session: AgentSession;
  source: "live" | "conv";
  frozen: boolean;
  sourcePaneWidth?: number | null;
  panelWidth: number;
}) {
  const parts: string[] = [session.target];
  if (session.command) parts.push(`Claude ${session.command}`);
  if (session.metadata.model) parts.push(session.metadata.model);
  if (session.metadata.contextPct !== null) parts.push(`${session.metadata.contextPct}% ctx`);

  const mode = modeIndicator(source, frozen);
  const widthRatio = source === "live" && sourcePaneWidth && sourcePaneWidth > panelWidth
    ? ` ${sourcePaneWidth}\u2192${panelWidth}`
    : "";

  return (
    <Box justifyContent="space-between">
      <Text>{parts.join(" \u00B7 ")}</Text>
      <Text dimColor>{mode}{widthRatio}</Text>
    </Box>
  );
}

function isVisuallyEmpty(line: string): boolean {
  return parseAnsiSequences(line).map(t => t.value).join("").trim() === "";
}

function LiveView({
  content,
  frozen,
  scrollOffset,
  visibleLines,
}: {
  content: string;
  frozen: boolean;
  scrollOffset: number;
  visibleLines: number;
}) {
  const lines = content.split("\n");

  // Trim trailing visually-empty lines (blank area between content and status bar)
  while (lines.length > 0 && isVisuallyEmpty(lines[lines.length - 1])) {
    lines.pop();
  }

  const totalLines = lines.length;

  let displayLines: string[];
  if (frozen) {
    const clampedOffset = Math.min(scrollOffset, Math.max(0, totalLines - visibleLines));
    displayLines = lines.slice(clampedOffset, clampedOffset + visibleLines);
  } else {
    displayLines = lines.slice(Math.max(0, totalLines - visibleLines));
  }

  return (
    <Box flexDirection="column" overflowX="hidden">
      {displayLines.map((line, i) => (
        <Box key={i}>
          <AnsiText text={line || " "} />
        </Box>
      ))}
    </Box>
  );
}

function ConvView({
  conversation,
  visibleLines,
  terminalWidth,
}: {
  conversation: ConversationEntry[];
  visibleLines: number;
  terminalWidth: number;
}) {
  // Available width: terminal width minus padding (2) and borders (2) and label prefix ("You: " = 5)
  const lineWidth = Math.max(40, terminalWidth - 9);
  const lineBudget = visibleLines;

  // Select entries that fit within the line budget, newest first (they're already newest-last)
  const visibleEntries: Array<{ role: string; display: string }> = [];
  let linesUsed = 0;
  for (let i = conversation.length - 1; i >= 0 && linesUsed < lineBudget; i--) {
    const entry = conversation[i];
    const maxLinesForEntry = Math.min(3, lineBudget - linesUsed);
    const display = fitText(entry.text, maxLinesForEntry, lineWidth);
    const entryLines = display.split("\n").length;
    visibleEntries.unshift({ role: entry.role, display });
    linesUsed += entryLines;
  }

  if (visibleEntries.length === 0) {
    return <Text dimColor>No conversation data</Text>;
  }

  return (
    <Box flexDirection="column">
      {visibleEntries.map((entry, i) => (
        <Box key={i} gap={1}>
          <Text color={entry.role === "user" ? "yellow" : "cyan"} bold>
            {entry.role === "user" ? "You:" : "AI:"}
          </Text>
          <Text dimColor={entry.role === "assistant"}>{entry.display}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function DetailPanel({
  session,
  source,
  frozen,
  liveContent,
  conversation = [],
  scrollOffset = 0,
  visibleLines = 20,
  terminalWidth = 80,
  sourcePaneWidth,
  paneAlive = true,
}: DetailPanelProps) {
  if (!session) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No agent sessions detected</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <MetadataHeader session={session} source={source} frozen={frozen}
        sourcePaneWidth={sourcePaneWidth} panelWidth={terminalWidth - 4} />
      {!paneAlive ? <Text dimColor italic>session ended</Text> : null}
      {source === "live" ? (
        <LiveView
          content={liveContent ?? ""}
          frozen={frozen}
          scrollOffset={scrollOffset}
          visibleLines={visibleLines - 1}
        />
      ) : (
        <ConvView
          conversation={conversation}
          visibleLines={visibleLines - 1}
          terminalWidth={terminalWidth}
        />
      )}
    </Box>
  );
}
