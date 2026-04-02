import { execFile } from "node:child_process";

export function capturePane(target: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "tmux",
      ["capture-pane", "-e", "-p", "-J", "-t", target],
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
