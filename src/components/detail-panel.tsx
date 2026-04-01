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

function truncateText(text: string, maxLen: number): string {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen - 3) + "..." : firstLine;
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
  return (
    <Box flexDirection="column" paddingX={1}>
      <MetadataHeader session={session} />
      {conversation.length > 0 ? (
        <Box flexDirection="column">
          {conversation.map((entry, i) => (
            <Box key={i} gap={1}>
              <Text color={entry.role === "user" ? "yellow" : "cyan"} bold>
                {entry.role === "user" ? "You:" : "AI:"}
              </Text>
              <Text dimColor={entry.role === "assistant"}>
                {truncateText(entry.text, 70)}
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
