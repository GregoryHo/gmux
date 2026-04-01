import { readdir, stat, open } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ConversationEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

/**
 * Convert a CWD path to Claude's project hash format.
 * e.g., "/Users/gregho/GitHub/AI/arcforge" → "-Users-gregho-GitHub-AI-arcforge"
 */
export function cwdToProjectHash(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

/**
 * Find the most recently modified .jsonl file in a Claude project directory.
 * Returns null if no session files exist.
 */
async function findLatestJsonl(projectDir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(projectDir);
  } catch {
    return null;
  }

  const jsonlFiles = entries.filter((f) => f.endsWith(".jsonl"));
  if (jsonlFiles.length === 0) return null;

  let latest: string | null = null;
  let latestMtime = 0;

  for (const file of jsonlFiles) {
    const fullPath = join(projectDir, file);
    try {
      const s = await stat(fullPath);
      if (s.mtimeMs > latestMtime) {
        latestMtime = s.mtimeMs;
        latest = fullPath;
      }
    } catch {
      continue;
    }
  }

  return latest;
}

/**
 * Read the last N lines of a file efficiently (read from end).
 */
async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  const CHUNK_SIZE = 8192;
  let fh;
  try {
    fh = await open(filePath, "r");
    const fileStat = await fh.stat();
    const fileSize = fileStat.size;

    if (fileSize === 0) return [];

    let position = fileSize;
    let buffer = "";
    const lines: string[] = [];

    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;

      const chunk = Buffer.alloc(readSize);
      await fh.read(chunk, 0, readSize, position);
      buffer = chunk.toString("utf-8") + buffer;

      const parts = buffer.split("\n");
      // Keep the incomplete first part in the buffer
      buffer = parts.shift() ?? "";

      // Collect complete lines from the end
      for (let i = parts.length - 1; i >= 0 && lines.length < maxLines; i--) {
        if (parts[i].trim().length > 0) {
          lines.unshift(parts[i]);
        }
      }
    }

    // Don't forget the remaining buffer (first line of file)
    if (buffer.trim().length > 0 && lines.length < maxLines) {
      lines.unshift(buffer);
    }

    return lines.slice(-maxLines);
  } catch {
    return [];
  } finally {
    await fh?.close();
  }
}

/**
 * Parse a JSONL line into a ConversationEntry, or null if not a user/assistant message.
 */
function parseJsonlLine(line: string): ConversationEntry | null {
  try {
    const obj = JSON.parse(line);

    // Only care about external user messages and assistant messages
    if (obj.type === "user" && obj.userType === "external") {
      const text = extractText(obj.message?.content);
      if (text) return { role: "user", text, timestamp: obj.timestamp ?? "" };
    }

    if (obj.type === "assistant") {
      const text = extractText(obj.message?.content);
      if (text) return { role: "assistant", text, timestamp: obj.timestamp ?? "" };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract human-readable text from a Claude message content field.
 * Content can be a string or an array of content blocks.
 */
function extractText(content: unknown): string | null {
  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null && "type" in block) {
        const b = block as { type: string; text?: string };
        if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
          return b.text.trim();
        }
      }
    }
  }

  return null;
}

/**
 * Read the recent conversation from a Claude Code session's JSONL file.
 * Maps CWD → project hash → latest .jsonl → parse last entries.
 *
 * @param cwd The working directory of the tmux pane
 * @param maxExchanges Maximum number of user/assistant pairs to return
 * @returns Array of conversation entries (newest last), or empty array on failure
 */
export const DEFAULT_CLAUDE_DIR = join(homedir(), ".claude");

export async function readConversation(
  cwd: string,
  maxExchanges: number = 3,
  claudeDir: string = DEFAULT_CLAUDE_DIR,
): Promise<ConversationEntry[]> {
  const hash = cwdToProjectHash(cwd);
  const projectDir = join(claudeDir, "projects", hash);

  const jsonlPath = await findLatestJsonl(projectDir);
  if (!jsonlPath) return [];

  // Read more lines than needed since many JSONL lines are tool calls, not conversation
  const rawLines = await readLastLines(jsonlPath, maxExchanges * 20);

  const entries: ConversationEntry[] = [];
  for (const line of rawLines) {
    const entry = parseJsonlLine(line);
    if (entry) entries.push(entry);
  }

  // Return the last N entries (newest last)
  return entries.slice(-maxExchanges * 2);
}
