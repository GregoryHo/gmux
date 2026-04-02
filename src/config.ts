import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { isNodeError } from "./utils.js";

export interface GmuxConfig {
  /** Interval between tmux polls in ms */
  pollInterval: number;
  /** Per-session macOS notification cooldown in ms */
  notificationCooldown: number;
  /** Play sound with macOS notifications */
  sound: boolean;
}

export const DEFAULT_CONFIG: GmuxConfig = {
  pollInterval: 3000,
  notificationCooldown: 300_000,
  sound: false,
};

export const CONFIG_PATH = join(
  homedir(),
  ".config",
  "gmux",
  "config.json",
);

export async function loadConfig(
  path: string = CONFIG_PATH,
): Promise<GmuxConfig> {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.warn("gmux: config is not an object, using defaults");
      return { ...DEFAULT_CONFIG };
    }

    return { ...DEFAULT_CONFIG, ...(parsed as Partial<GmuxConfig>) };
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      // File doesn't exist — use defaults silently
      return { ...DEFAULT_CONFIG };
    }
    if (err instanceof SyntaxError) {
      console.warn("gmux: invalid JSON in config, using defaults");
      return { ...DEFAULT_CONFIG };
    }
    console.warn(`gmux: failed to read config: ${err}`);
    return { ...DEFAULT_CONFIG };
  }
}

