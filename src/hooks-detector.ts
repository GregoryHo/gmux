import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

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

  const hasGmuxHook = (eventHooks: unknown): boolean => {
    if (!Array.isArray(eventHooks)) return false;
    return eventHooks.some((rule: unknown) => {
      if (typeof rule !== "object" || rule === null) return false;
      const r = rule as Record<string, unknown>;
      // Check correct format: { hooks: [{ command: "...gmux..." }] }
      const hooks = r.hooks;
      if (Array.isArray(hooks)) {
        return hooks.some((h: unknown) => {
          if (typeof h !== "object" || h === null) return false;
          const cmd = (h as Record<string, unknown>).command;
          return typeof cmd === "string" && cmd.includes("gmux");
        });
      }
      // Also detect old broken format: { script: "...gmux..." }
      const script = r.script;
      return typeof script === "string" && script.includes("gmux");
    });
  };

  return hasGmuxHook(hookObj.Stop) || hasGmuxHook(hookObj.Notification);
}
