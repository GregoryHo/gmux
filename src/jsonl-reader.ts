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

  const stats = await Promise.all(
    jsonlFiles.map(async (file) => {
      const fullPath = join(projectDir, file);
      try {
        const s = await stat(fullPath);
        return { path: fullPath, mtimeMs: s.mtimeMs };
      } catch {
        return null;
      }
    }),
  );

  let latest: { path: string; mtimeMs: number } | null = null;
  for (const s of stats) {
    if (s && (!latest || s.mtimeMs > latest.mtimeMs)) latest = s;
  }

  return latest?.path ?? null;
}

/**
 * Read the last N non-empty lines of a file.
 * Reads a tail chunk from the end rather than the entire file.
 */
async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  // Read a generous tail chunk — 64KB covers ~1000 JSONL lines
  const TAIL_SIZE = 65536;
  let fh;
  try {
    fh = await open(filePath, "r");
    const fileStat = await fh.stat();
    const fileSize = fileStat.size;
    if (fileSize === 0) return [];

    const readSize = Math.min(TAIL_SIZE, fileSize);
    const position = fileSize - readSize;
    const chunk = Buffer.alloc(readSize);
    await fh.read(chunk, 0, readSize, position);

    const lines = chunk.toString("utf-8").split("\n").filter((l) => l.trim().length > 0);
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
 * @param maxEntries Maximum number of conversation entries (individual messages) to return
 * @returns Array of conversation entries (newest last), or empty array on failure
 */
export const DEFAULT_CLAUDE_DIR = join(homedir(), ".claude");

export async function readConversation(
  cwd: string,
  maxEntries: number = 6,
  claudeDir: string = DEFAULT_CLAUDE_DIR,
): Promise<ConversationEntry[]> {
  const hash = cwdToProjectHash(cwd);
  const projectDir = join(claudeDir, "projects", hash);

  const jsonlPath = await findLatestJsonl(projectDir);
  if (!jsonlPath) return [];

  // Read more lines than needed since many JSONL lines are tool calls, not conversation
  const rawLines = await readLastLines(jsonlPath, maxEntries * 20);

  const entries: ConversationEntry[] = [];
  for (const line of rawLines) {
    const entry = parseJsonlLine(line);
    if (entry) entries.push(entry);
  }

  return entries.slice(-maxEntries);
}
