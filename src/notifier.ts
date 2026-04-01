import { execFile } from "node:child_process";
import type { GmuxConfig } from "./config.js";

/**
 * Send a macOS notification using osascript.
 *
 * If osascript fails (e.g. not on macOS), the error is logged
 * as a warning and swallowed — never crashes the process.
 */
export function sendMacOSNotification(
  title: string,
  body: string,
  sound: boolean,
): Promise<void> {
  let script = `display notification "${body}" with title "${title}"`;
  if (sound) {
    script += ` sound name "default"`;
  }

  return new Promise<void>((resolve) => {
    execFile("osascript", ["-e", script], (err) => {
      if (err) {
        console.warn(`gmux: macOS notification failed: ${err.message}`);
      }
      resolve();
    });
  });
}

/**
 * Notifier manages macOS desktop notifications with per-session cooldown.
 *
 * In-dashboard visual notifications are never rate-limited — they always
 * appear. Only the OS-level notifications respect the cooldown.
 */
export class Notifier {
  private readonly config: GmuxConfig;
  private readonly lastNotifyTime = new Map<string, number>();

  constructor(config: GmuxConfig) {
    this.config = config;
  }

  /**
   * Fire a macOS notification for a session event, respecting cooldown.
   *
   * If the same session was notified within `config.notificationCooldown` ms,
   * the notification is silently suppressed.
   */
  notify(session: string, message: string): void {
    const now = Date.now();
    const last = this.lastNotifyTime.get(session);

    if (last !== undefined && now - last < this.config.notificationCooldown) {
      return;
    }

    this.lastNotifyTime.set(session, now);

    void sendMacOSNotification(
      "gmux",
      `[${session}] ${message}`,
      this.config.sound,
    );
  }
}
