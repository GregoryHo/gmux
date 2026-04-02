import { execFile } from "node:child_process";

export function capturePane(target: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "tmux",
      ["capture-pane", "-e", "-p", "-t", target],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export function getPaneWidth(target: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      "tmux",
      ["display-message", "-t", target, "-p", "#{pane_width}"],
      { timeout: 2000 },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const width = parseInt(stdout.trim(), 10);
        resolve(Number.isNaN(width) ? null : width);
      },
    );
  });
}
