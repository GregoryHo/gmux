import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { hasGmuxHookEntry, type HookRule } from "./utils.js";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

/**
 * Claude Code expects: { matcher: "", hooks: [{ type: "command", command: "..." }] }
 */
function makeHookRule(scriptPath: string): HookRule {
  return {
    matcher: "",
    hooks: [{ type: "command", command: scriptPath }],
  };
}

function removeOldGmuxEntries(entries: unknown[]): unknown[] {
  return entries.filter((e: unknown) => {
    if (typeof e !== "object" || e === null) return true;
    const obj = e as Record<string, unknown>;
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

  // Clean up old malformed entries from previous gmux versions
  if (Array.isArray(hooks.Stop)) hooks.Stop = removeOldGmuxEntries(hooks.Stop);
  if (Array.isArray(hooks.Notification)) hooks.Notification = removeOldGmuxEntries(hooks.Notification);

  if (!Array.isArray(hooks.Stop)) hooks.Stop = [];
  if (!hasGmuxHookEntry(hooks.Stop)) {
    hooks.Stop.push(makeHookRule(statusScript));
  }

  if (!Array.isArray(hooks.Notification)) hooks.Notification = [];
  if (!hasGmuxHookEntry(hooks.Notification)) {
    hooks.Notification.push(makeHookRule(attentionScript));
  }

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
