export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/** Extract session name from a tmux target string like "session:window.pane". */
export function sessionNameFromTarget(target: string): string {
  const colonIdx = target.indexOf(":");
  return colonIdx > 0 ? target.substring(0, colonIdx) : target;
}

/** Claude Code hook rule format: { matcher, hooks: [{ type, command }] } */
export interface HookRule {
  matcher: string;
  hooks: Array<{ type: string; command: string }>;
}

/** Check if a hook event array contains a gmux entry (correct format only). */
export function hasGmuxHookEntry(entries: unknown[]): boolean {
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
