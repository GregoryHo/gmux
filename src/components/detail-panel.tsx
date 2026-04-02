import { Box, Text } from "ink";
import type { AgentSession } from "../types.js";
import type { ConversationEntry } from "../jsonl-reader.js";

export interface DetailPanelProps {
  session: AgentSession | null;
  /** Recent conversation entries from JSONL (compact view). */
  conversation?: ConversationEntry[];
  /** When true, show full scrollback content instead of compact view. */
  expanded?: boolean;
  /** Full scrollback content for expanded view. */
  scrollbackContent?: string;
  /** Scroll offset for expanded view (lines from top). */
  scrollOffset?: number;
  /** Visible lines in expanded view. */
  visibleLines?: number;
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

function MetadataHeader({ session }: { session: AgentSession }) {
  const parts: string[] = [session.target];
  if (session.command) parts.push(`Claude ${session.command}`);
  if (session.metadata.model) parts.push(session.metadata.model);
  if (session.metadata.contextPct !== null) parts.push(`${session.metadata.contextPct}% ctx`);
  return <Text>{parts.join(" \u00B7 ")}</Text>;
}

export function DetailPanel({
  session,
  conversation = [],
  expanded = false,
  scrollbackContent,
  scrollOffset = 0,
  visibleLines = 20,
}: DetailPanelProps) {
  if (!session) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No agent sessions detected</Text>
      </Box>
    );
  }

  // === Expanded view: full scrollback relay ===
  if (expanded && scrollbackContent !== undefined) {
    const lines = scrollbackContent.split("\n");
    const totalLines = lines.length;
    const clampedOffset = Math.min(scrollOffset, Math.max(0, totalLines - visibleLines));
    const visible = lines.slice(clampedOffset, clampedOffset + visibleLines);

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold>{session.sessionName} — Full Transcript</Text>
          <Text dimColor>
            {clampedOffset + 1}-{Math.min(clampedOffset + visibleLines, totalLines)} of {totalLines} · j/k scroll · Esc close
          </Text>
        </Box>
        {visible.map((line, i) => (
          <Text key={clampedOffset + i}>{line || " "}</Text>
        ))}
      </Box>
    );
  }

  // === Compact view: metadata + JSONL conversation preview ===
  // Estimate available width (terminal width minus padding/borders/label)
  const lineWidth = 80;
  // Budget: visible lines minus 1 for metadata header
  const lineBudget = (visibleLines ?? 20) - 1;

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

  return (
    <Box flexDirection="column" paddingX={1}>
      <MetadataHeader session={session} />
      {visibleEntries.length > 0 ? (
        <Box flexDirection="column">
          {visibleEntries.map((entry, i) => (
            <Box key={i} gap={1}>
              <Text color={entry.role === "user" ? "yellow" : "cyan"} bold>
                {entry.role === "user" ? "You:" : "AI:"}
              </Text>
              <Text dimColor={entry.role === "assistant"}>
                {entry.display}
              </Text>
            </Box>
          ))}
        </Box>
      ) : (
        <Text dimColor>No conversation data</Text>
      )}
    </Box>
  );
}
