# Hook Integration (v1.2) Tasks

> **Goal:** Fix broken hook scripts, add Notification hook, detect hook config at startup, provide --setup-hooks CLI.
> **Architecture:** Fix shell scripts to use `tmux display-message`. Add `hooks-detector.ts` module. Add CLI arg parsing in `index.tsx` before Ink render.
> **Tech Stack:** Bash (hook scripts), TypeScript (detection + CLI), Vitest.

> **For Claude:** Use arc-executing-tasks to implement.

## Context

Hook scripts (`hooks/gmux-status.sh`, `hooks/gmux-notify.sh`) use `$TMUX_PANE` for both session and pane fields, which gives pane ID (e.g., `%5`) instead of `session_name:window.pane` target. This means socket events from hooks never match gmux's session store. Additionally, there's no Notification event hook and no way for gmux to detect/install hooks.

Design: `docs/plans/2026-04-02-ux-polish-design.md`
Spec: `specs/details/hooks-v2.xml`

## Tasks

### Task 1: Fix hook scripts

**Files:**
- Modify: `hooks/gmux-status.sh`
- Modify: `hooks/gmux-notify.sh`

**Step 1: Write failing test**

```typescript
// src/__tests__/socket-hooks.test.ts — add test
describe("hook scripts", () => {
  it("gmux-status.sh uses tmux display-message for session/pane", async () => {
    const content = await fs.readFile("hooks/gmux-status.sh", "utf8");
    expect(content).toContain("tmux display-message");
    expect(content).not.toContain('SESSION="${TMUX_PANE');
  });

  it("gmux-notify.sh uses tmux display-message for session/pane", async () => {
    const content = await fs.readFile("hooks/gmux-notify.sh", "utf8");
    expect(content).toContain("tmux display-message");
    expect(content).not.toContain('SESSION="${TMUX_PANE');
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/socket-hooks.test.ts`
Expected: FAIL — scripts still use `$TMUX_PANE`

**Step 3: Implement**

Replace in both `hooks/gmux-status.sh` and `hooks/gmux-notify.sh`:

```bash
# Before (broken)
SESSION="${TMUX_PANE:-unknown}"
PANE="${TMUX_PANE:-unknown}"

# After (correct)
SESSION="$(tmux display-message -p '#{session_name}' 2>/dev/null || echo unknown)"
PANE="$(tmux display-message -p '#{window_index}.#{pane_index}' 2>/dev/null || echo unknown)"
```

Also update the comment header of `gmux-notify.sh`:
```bash
# Install: claude hooks add Stop --script "path/to/gmux-notify.sh"
```
Change `Stop` to `Notification` since this script will be used for the Notification event in the new setup (but keep backward compatibility — the script itself works for either event).

**Step 4: Verify**
Run: `npx vitest run src/__tests__/socket-hooks.test.ts`
Expected: PASS

**Step 5: Commit**
`git commit -m "fix: hook scripts use tmux display-message for correct session/pane"`

---

### Task 2: Notification hook script

**Files:**
- Create: `hooks/gmux-attention.sh`

**Step 1: Write failing test**

Add to `src/__tests__/socket-hooks.test.ts`:

```typescript
it("gmux-attention.sh exists and sends needs_attention status", async () => {
  const content = await fs.readFile("hooks/gmux-attention.sh", "utf8");
  expect(content).toContain("needs_attention");
  expect(content).toContain("tmux display-message");
  expect(content).toContain("/tmp/gmux.sock");
  expect(content).toContain("exit 0");
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/socket-hooks.test.ts`
Expected: FAIL — file doesn't exist

**Step 3: Implement**

Create `hooks/gmux-attention.sh`:

```bash
#!/usr/bin/env bash
# gmux-attention.sh — Claude Code hook script (Notification event)
# Sends a needs_attention status to the gmux dashboard socket.
# Install: claude hooks add Notification --script "path/to/gmux-attention.sh"
#
# Exits 0 always — must never block Claude Code.

SOCKET="/tmp/gmux.sock"

# If socket doesn't exist, exit silently
[ -S "$SOCKET" ] || exit 0

# Extract session and pane from tmux
SESSION="$(tmux display-message -p '#{session_name}' 2>/dev/null || echo unknown)"
PANE="$(tmux display-message -p '#{window_index}.#{pane_index}' 2>/dev/null || echo unknown)"

JSON="{\"event\":\"status\",\"session\":\"${SESSION}\",\"pane\":\"${PANE}\",\"status\":\"needs_attention\"}"

# Try to write to the socket. Use socat if available, fall back to nc.
if command -v socat >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | socat - UNIX-CONNECT:"$SOCKET" 2>/dev/null
elif command -v nc >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | nc -U "$SOCKET" 2>/dev/null
fi

exit 0
```

Make executable: `chmod +x hooks/gmux-attention.sh`

**Step 4: Verify**
Run: `npx vitest run src/__tests__/socket-hooks.test.ts`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add gmux-attention.sh for Notification event hook"`

---

### Task 3: Hook detection module

**Files:**
- Create: `src/hooks-detector.ts`
- Create: `src/__tests__/hooks-detector.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/hooks-detector.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectHooks } from "../hooks-detector.js";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

describe("detectHooks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when settings.json contains gmux hook entries", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      hooks: {
        Stop: [{ script: "/path/to/gmux-status.sh" }],
        Notification: [{ script: "/path/to/gmux-attention.sh" }],
      },
    }));
    expect(await detectHooks()).toBe(true);
  });

  it("returns false when settings.json does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    expect(await detectHooks()).toBe(false);
  });

  it("returns false when settings.json has no gmux hooks", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      permissions: { allow: ["Read"] },
    }));
    expect(await detectHooks()).toBe(false);
  });

  it("returns false when settings.json is malformed JSON", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("not json {{{");
    expect(await detectHooks()).toBe(false);
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/hooks-detector.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Implement**

```typescript
// src/hooks-detector.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

/**
 * Check if ~/.claude/settings.json contains gmux hook entries.
 * Looks for hook scripts referencing "gmux" in Stop and Notification events.
 */
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
    return eventHooks.some((h: unknown) => {
      if (typeof h !== "object" || h === null) return false;
      const script = (h as Record<string, unknown>).script;
      return typeof script === "string" && script.includes("gmux");
    });
  };

  return hasGmuxHook(hookObj.Stop) || hasGmuxHook(hookObj.Notification);
}
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/hooks-detector.test.ts`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add hook detection module (reads ~/.claude/settings.json)"`

---

### Task 4: Wire hook detection into Header

**Files:**
- Modify: `src/components/header.tsx`
- Modify: `src/__tests__/header.test.tsx`
- Modify: `src/app.tsx`
- Modify: `src/index.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/header.test.tsx`:

```typescript
it("shows warning when hooks not configured", () => {
  const { lastFrame } = render(
    <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true} hooksConfigured={false} />
  );
  const output = lastFrame() ?? "";
  expect(output).toContain("⚠");
  expect(output).toContain("hooks");
});

it("shows no hooks warning when configured", () => {
  const { lastFrame } = render(
    <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true} hooksConfigured={true} />
  );
  const output = lastFrame() ?? "";
  expect(output).not.toContain("hooks");
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/header.test.tsx`
Expected: FAIL — `hooksConfigured` prop doesn't exist

**Step 3: Implement**

Update `HeaderProps` in `src/components/header.tsx`:

```typescript
export interface HeaderProps {
  sessionCount: number;
  activeCount: number;
  degraded: boolean;
  socketAvailable: boolean;
  hooksConfigured?: boolean;
  focusSession?: string;
}
```

Update warning logic:

```typescript
let warningText = "";
if (degraded) warningText = "⚠ tmux";
else if (!socketAvailable) warningText = "⚠ socket";
else if (hooksConfigured === false) warningText = "⚠ hooks";
```

In `src/index.tsx`, call `detectHooks()` at startup and pass result to `<App>`:

```typescript
import { detectHooks } from "./hooks-detector.js";

async function main() {
  const config = await loadConfig();
  const hooksConfigured = await detectHooks();
  // ... startup ...
  const { waitUntilExit } = render(
    <App config={config} server={result.server} hooksConfigured={hooksConfigured} />
  );
}
```

Update `AppProps` to include `hooksConfigured: boolean` and pass to `<Header>`.

**Step 4: Verify**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 5: Commit**
`git commit -m "feat: wire hook detection into Header warning system"`

---

### Task 5: --setup-hooks CLI command

**Files:**
- Create: `src/setup-hooks.ts`
- Create: `src/__tests__/setup-hooks.test.ts`
- Modify: `src/index.tsx`

**Step 1: Write failing test**

```typescript
// src/__tests__/setup-hooks.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupHooks } from "../setup-hooks.js";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

describe("setupHooks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates settings.json with hook entries when file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await setupHooks("/mock/hooks");

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.hooks.Stop).toBeDefined();
    expect(written.hooks.Notification).toBeDefined();
  });

  it("preserves existing settings when adding hooks", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      permissions: { allow: ["Read"] },
    }));
    vi.mocked(fs.writeFile).mockResolvedValue();

    await setupHooks("/mock/hooks");

    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.permissions).toEqual({ allow: ["Read"] });
    expect(written.hooks.Stop).toBeDefined();
  });

  it("is idempotent — does not duplicate entries", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      hooks: {
        Stop: [{ script: "/mock/hooks/gmux-status.sh" }],
        Notification: [{ script: "/mock/hooks/gmux-attention.sh" }],
      },
    }));
    vi.mocked(fs.writeFile).mockResolvedValue();

    await setupHooks("/mock/hooks");

    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(1);
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/setup-hooks.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Implement**

```typescript
// src/setup-hooks.ts
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

  // Read existing settings or start fresh
  let settings: Record<string, unknown> = {};
  try {
    const content = await readFile(settingsPath, "utf8");
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist or is malformed — start fresh
  }

  // Ensure hooks object exists
  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;

  // Add Stop hook if not already present
  const hasGmuxEntry = (entries: unknown[], scriptPath: string): boolean => {
    if (!Array.isArray(entries)) return false;
    return entries.some((e: unknown) => {
      if (typeof e !== "object" || e === null) return false;
      return (e as Record<string, unknown>).script === scriptPath;
    });
  };

  if (!Array.isArray(hooks.Stop)) hooks.Stop = [];
  if (!hasGmuxEntry(hooks.Stop, statusScript)) {
    hooks.Stop.push({ script: statusScript });
  }

  if (!Array.isArray(hooks.Notification)) hooks.Notification = [];
  if (!hasGmuxEntry(hooks.Notification, attentionScript)) {
    hooks.Notification.push({ script: attentionScript });
  }

  // Write back
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
```

**Step 4: Wire into index.tsx**

Add CLI arg parsing at the top of `main()`:

```typescript
async function main() {
  if (process.argv.includes("--setup-hooks")) {
    const { setupHooks } = await import("./setup-hooks.js");
    const hooksDir = resolve(dirname(new URL(import.meta.url).pathname), "..", "hooks");
    try {
      await setupHooks(hooksDir);
      console.log("gmux: hooks configured in ~/.claude/settings.json");
      process.exit(0);
    } catch (err) {
      console.error(`gmux: failed to setup hooks: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }

  // ... rest of main()
}
```

**Step 5: Verify**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 6: Commit**
`git commit -m "feat: add gmux --setup-hooks CLI command"`

---

### Task 6: Integration verification

**Files:**
- No new files

**Step 1: Run full test suite**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 2: Build check**
Run: `npm run build`
Expected: Compiles without errors

**Step 3: Commit (if any fixups needed)**
`git commit -m "fix: hooks-v2 integration fixups"`
