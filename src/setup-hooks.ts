import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

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

  const hasEntry = (entries: unknown[], scriptPath: string): boolean => {
    if (!Array.isArray(entries)) return false;
    return entries.some((e: unknown) => {
      if (typeof e !== "object" || e === null) return false;
      return (e as Record<string, unknown>).script === scriptPath;
    });
  };

  if (!Array.isArray(hooks.Stop)) hooks.Stop = [];
  if (!hasEntry(hooks.Stop, statusScript)) {
    hooks.Stop.push({ script: statusScript });
  }

  if (!Array.isArray(hooks.Notification)) hooks.Notification = [];
  if (!hasEntry(hooks.Notification, attentionScript)) {
    hooks.Notification.push({ script: attentionScript });
  }

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
