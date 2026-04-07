import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

/**
 * Build a Claude Code hook rule entry in the correct format.
 * Claude Code expects: { matcher: "", hooks: [{ type: "command", command: "..." }] }
 */
function makeHookRule(scriptPath: string): Record<string, unknown> {
  return {
    matcher: "",
    hooks: [{ type: "command", command: scriptPath }],
  };
}

/**
 * Check if a hook event array already contains a gmux entry.
 */
function hasGmuxEntry(entries: unknown[]): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((rule: unknown) => {
    if (typeof rule !== "object" || rule === null) return false;
    const r = rule as Record<string, unknown>;
    const hooks = r.hooks;
    if (!Array.isArray(hooks)) return false;
    return hooks.some((h: unknown) => {
      if (typeof h !== "object" || h === null) return false;
      const cmd = (h as Record<string, unknown>).command;
      return typeof cmd === "string" && cmd.includes("gmux");
    });
  });
}

/**
 * Remove any malformed gmux entries (old { script: "..." } format).
 */
function removeOldGmuxEntries(entries: unknown[]): unknown[] {
  return entries.filter((e: unknown) => {
    if (typeof e !== "object" || e === null) return true;
    const obj = e as Record<string, unknown>;
    // Remove entries with { script: "...gmux..." } (old broken format)
    if (typeof obj.script === "string" && obj.script.includes("gmux")) return false;
    return true;
  });
}

export async function setupHooks(
  hooksDir: string,
  settingsPath: string = CLAUDE_SETTINGS_PATH,
): Promise<void> {
  const statusScript = resolve(hooksDir, "gmux-status.sh");
  const attentionScript = resolve(hooksDir, "gmux-attention.sh");

  let settings: Record<string, unknown> = {};
  try {
    const content = await readFile(settingsPath, "utf8");
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist or malformed — start fresh
  }

  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;

  // Clean up any old malformed entries from previous gmux versions
  if (Array.isArray(hooks.Stop)) hooks.Stop = removeOldGmuxEntries(hooks.Stop);
  if (Array.isArray(hooks.Notification)) hooks.Notification = removeOldGmuxEntries(hooks.Notification);

  if (!Array.isArray(hooks.Stop)) hooks.Stop = [];
  if (!hasGmuxEntry(hooks.Stop)) {
    hooks.Stop.push(makeHookRule(statusScript));
  }

  if (!Array.isArray(hooks.Notification)) hooks.Notification = [];
  if (!hasGmuxEntry(hooks.Notification)) {
    hooks.Notification.push(makeHookRule(attentionScript));
  }

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
