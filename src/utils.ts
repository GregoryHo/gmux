export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/** Extract session name from a tmux target string like "session:window.pane". */
export function sessionNameFromTarget(target: string): string {
  const colonIdx = target.indexOf(":");
  return colonIdx > 0 ? target.substring(0, colonIdx) : target;
}
