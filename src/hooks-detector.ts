import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { hasGmuxHookEntry } from "./utils.js";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

export async function detectHooks(
  settingsPath: string = CLAUDE_SETTINGS_PATH,
): Promise<boolean> {
  let content: string;
  try {
    content = await readFile(settingsPath, "utf8");
  } catch {
    return false;
  }

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(content);
  } catch {
    return false;
  }

  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object") return false;

  const hookObj = hooks as Record<string, unknown>;
  const stopHooks = hookObj.Stop;
  const notifHooks = hookObj.Notification;

  return (
    (Array.isArray(stopHooks) && hasGmuxHookEntry(stopHooks)) ||
    (Array.isArray(notifHooks) && hasGmuxHookEntry(notifHooks))
  );
}
