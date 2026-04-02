# Layout Redesign Tasks

> **Goal:** Redesign gmux dashboard with fullscreen alternate screen, proportional zone layout (Overview/Focus modes), warning integration in header, separated notifications zone, and session search.
> **Architecture:** Two layout modes (Overview = 4-zone proportional, Focus = detail takes all space). Fullscreen via alternate screen buffer + `useStdout` height binding. `j/k` is context-sensitive per mode.
> **Tech Stack:** React + Ink `useStdout()`, ANSI escape sequences for alternate screen.

> **For Claude:** Use arc-executing-tasks to implement.

## Context

Current dashboard has no fullscreen, Zone 3 mixes detail+notifications, no session search, no height constraints, warnings are separate banners. This redesign changes the layout engine without touching data layer (poller, socket, JSONL, heuristics).

Design: `docs/plans/2026-04-02-layout-redesign.md`

## Tasks

### Task 1: Alternate screen buffer in index.tsx

**Files:**
- Modify: `src/index.tsx`
- Modify: `src/lifecycle.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/alternate-screen.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("alternate screen", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("enterAlternateScreen writes the correct escape", async () => {
    const { enterAlternateScreen } = await import("../screen.js");
    enterAlternateScreen();
    expect(writeSpy).toHaveBeenCalledWith("\x1b[?1049h");
  });

  it("exitAlternateScreen writes the correct escape", async () => {
    const { exitAlternateScreen } = await import("../screen.js");
    exitAlternateScreen();
    expect(writeSpy).toHaveBeenCalledWith("\x1b[?1049l");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/alternate-screen.test.ts`
Expected: FAIL — `screen.js` doesn't exist

**Step 3: Implement**

```typescript
// src/screen.ts
const ENTER = "\x1b[?1049h";
const EXIT = "\x1b[?1049l";

export function enterAlternateScreen(): void {
  process.stdout.write(ENTER);
}

export function exitAlternateScreen(): void {
  process.stdout.write(EXIT);
}
```

**Step 4: Wire into index.tsx**

In `src/index.tsx`, add:
- `enterAlternateScreen()` before `render()`
- `exitAlternateScreen()` after `waitUntilExit()` and inside `cleanup()`

In `src/lifecycle.ts`, update `registerSignalHandlers` to import and call `exitAlternateScreen()` before `process.exit(0)`.

```typescript
// src/index.tsx — updated main()
import { enterAlternateScreen, exitAlternateScreen } from "./screen.js";

async function main() {
  const config = await loadConfig();

  let result;
  try {
    result = await startup();
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }

  enterAlternateScreen();
  registerSignalHandlers(result.server ?? undefined);

  const { waitUntilExit } = render(<App config={config} server={result.server} />);

  await waitUntilExit();
  exitAlternateScreen();
  await cleanup(result.server ?? undefined);
}
```

In `src/lifecycle.ts` — update `registerSignalHandlers`:
```typescript
import { exitAlternateScreen } from "./screen.js";

export function registerSignalHandlers(server?: Server): void {
  let shuttingDown = false;

  const handler = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    exitAlternateScreen();
    await cleanup(server);
    process.exit(0);
  };

  process.on("SIGINT", () => void handler());
  process.on("SIGTERM", () => void handler());
}
```

**Step 5: Verify**
Run: `npx vitest run src/__tests__/alternate-screen.test.ts`
Expected: PASS

**Step 6: Commit**
`git commit -m "feat: add alternate screen buffer for fullscreen mode"`

---

### Task 2: Fullscreen root Box with useStdout height

**Files:**
- Modify: `src/app.tsx`

**Step 1: Write failing test**

```typescript
// src/__tests__/layout.test.tsx
import { describe, it, expect } from "vitest";

describe("layout height calculation", () => {
  it("calculates zone heights from terminal rows", () => {
    const { calculateZoneHeights } = require("../layout.js");
    const heights = calculateZoneHeights(40);

    expect(heights.header).toBe(1);
    expect(heights.input).toBe(1);
    expect(heights.session + heights.detail + heights.notify).toBe(40 - 1 - 1 - 3);
    expect(heights.session).toBeGreaterThanOrEqual(3);
    expect(heights.notify).toBeGreaterThanOrEqual(3);
    expect(heights.detail).toBeGreaterThan(heights.session);
  });

  it("enforces minimum zone heights for small terminals", () => {
    const { calculateZoneHeights } = require("../layout.js");
    const heights = calculateZoneHeights(20);

    expect(heights.session).toBeGreaterThanOrEqual(3);
    expect(heights.notify).toBeGreaterThanOrEqual(3);
    expect(heights.detail).toBeGreaterThanOrEqual(3);
  });

  it("calculates focus mode height", () => {
    const { calculateFocusHeight } = require("../layout.js");
    const height = calculateFocusHeight(40);

    // rows - header(1) - input(1) - border(1)
    expect(height).toBe(37);
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/layout.test.tsx`
Expected: FAIL — `layout.js` doesn't exist

**Step 3: Implement**

```typescript
// src/layout.ts
export interface ZoneHeights {
  header: number;
  session: number;
  detail: number;
  notify: number;
  input: number;
}

const HEADER_HEIGHT = 1;
const INPUT_HEIGHT = 1;
const BORDER_COUNT = 3;

export function calculateZoneHeights(rows: number): ZoneHeights {
  const flexRows = rows - HEADER_HEIGHT - INPUT_HEIGHT - BORDER_COUNT;
  const sessionHeight = Math.max(3, Math.floor(flexRows * 0.20));
  const notifyHeight = Math.max(3, Math.floor(flexRows * 0.20));
  const detailHeight = Math.max(3, flexRows - sessionHeight - notifyHeight);

  return {
    header: HEADER_HEIGHT,
    session: sessionHeight,
    detail: detailHeight,
    notify: notifyHeight,
    input: INPUT_HEIGHT,
  };
}

export function calculateFocusHeight(rows: number): number {
  return rows - HEADER_HEIGHT - INPUT_HEIGHT - 1; // 1 border between detail and input
}
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/layout.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add layout height calculation module"`

---

### Task 3: Header with integrated warnings

**Files:**
- Create: `src/components/header.tsx`
- Test: `src/__tests__/header.test.tsx`

**Step 1: Write failing test**

```typescript
// src/__tests__/header.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Header } from "../components/header.js";

describe("Header", () => {
  it("renders session count and time", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("gmux");
    expect(output).toContain("5 sessions");
    expect(output).toContain("3 active");
  });

  it("shows warning icon when degraded", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={0} degraded={true} socketAvailable={true} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("⚠");
    expect(output).toContain("tmux");
  });

  it("shows warning icon when socket unavailable", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={0} degraded={false} socketAvailable={false} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("⚠");
    expect(output).toContain("socket");
  });

  it("renders Focus mode header with session name", () => {
    const { lastFrame } = render(
      <Header sessionCount={5} activeCount={3} degraded={false} socketAvailable={true}
        focusSession="arcforge:1.1" />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("arcforge:1.1");
    expect(output).toContain("Esc");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/header.test.tsx`
Expected: FAIL — `header.js` doesn't exist

**Step 3: Implement**

```tsx
// src/components/header.tsx
import { Box, Text } from "ink";

export interface HeaderProps {
  sessionCount: number;
  activeCount: number;
  degraded: boolean;
  socketAvailable: boolean;
  focusSession?: string;
}

export function Header({ sessionCount, activeCount, degraded, socketAvailable, focusSession }: HeaderProps) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const warningColor = degraded || !socketAvailable ? "yellow" : undefined;

  if (focusSession) {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text bold color={warningColor}>gmux</Text>
          <Text>— {focusSession} · Full Transcript</Text>
        </Box>
        <Text dimColor>Esc ←</Text>
      </Box>
    );
  }

  let warningText = "";
  if (degraded) warningText = "⚠ tmux";
  else if (!socketAvailable) warningText = "⚠ socket";

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text bold color={warningColor}>gmux</Text>
        <Text color={warningColor}>
          — {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          {activeCount > 0 ? ` · ${activeCount} active` : ""}
        </Text>
        {warningText ? <Text color="yellow" bold>{warningText}</Text> : null}
      </Box>
      <Text dimColor>{timeStr}</Text>
    </Box>
  );
}
```

**Step 4: Export from index.ts**

Add to `src/components/index.ts`:
```typescript
export { Header } from "./header.js";
export type { HeaderProps } from "./header.js";
```

**Step 5: Verify**
Run: `npx vitest run src/__tests__/header.test.tsx`
Expected: PASS

**Step 6: Commit**
`git commit -m "feat: add Header component with integrated warnings"`

---

### Task 4: Session list with height constraint and internal scroll

**Files:**
- Modify: `src/components/session-list.tsx`
- Modify: `src/__tests__/session-list.test.tsx`

**Step 1: Write failing test**

```typescript
// Add to src/__tests__/session-list.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { SessionList } from "../components/session-list.js";
import type { AgentSession } from "../types.js";

// helper to create mock sessions
function mockSession(name: string, idx: number): AgentSession {
  return {
    target: `${name}:1.${idx}`,
    sessionName: name,
    command: "2.1.89",
    cwd: `/Users/test/${name}`,
    tty: `/dev/ttys0${idx}`,
    pid: 1000 + idx,
    status: "idle",
    metadata: { lastOutput: null, model: null, contextPct: null },
    paneContent: "-- INSERT --",
  };
}

describe("SessionList with height constraint", () => {
  it("renders within height limit with scrolling indicator", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => mockSession(`session${i}`, i));
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} maxHeight={5} />
    );
    const output = lastFrame() ?? "";
    const lines = output.split("\n").filter(l => l.trim());
    // Should show at most maxHeight rows, not all 10
    expect(lines.length).toBeLessThanOrEqual(6); // 5 + possible scroll indicator
  });

  it("filters sessions by searchQuery", () => {
    const sessions = [
      mockSession("arcforge", 0),
      mockSession("workspace", 1),
      mockSession("settings", 2),
    ];
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} searchQuery="arc" />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("arcforge");
    expect(output).not.toContain("workspace");
    expect(output).not.toContain("settings");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/session-list.test.tsx`
Expected: FAIL — `maxHeight` and `searchQuery` props don't exist

**Step 3: Implement**

Update `SessionListProps` in `src/components/session-list.tsx`:

```typescript
export interface SessionListProps {
  sessions: AgentSession[];
  selectedIndex: number;
  dimmed?: boolean;
  maxHeight?: number;
  searchQuery?: string;
}
```

Update the `SessionList` component:
- Filter sessions by `searchQuery` (fuzzy match on `sessionName`)
- Compute a visible window based on `maxHeight` and `selectedIndex`
- Show scroll indicators (`▲`/`▼`) when content overflows

```typescript
export function SessionList({
  sessions,
  selectedIndex,
  dimmed = false,
  maxHeight,
  searchQuery,
}: SessionListProps) {
  // Filter by search query
  const filtered = searchQuery
    ? sessions.filter((s) =>
        s.sessionName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sessions;

  if (filtered.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>
          {searchQuery ? "No matching sessions" : "No agent sessions detected"}
        </Text>
      </Box>
    );
  }

  // Compute visible window
  let visibleSessions = filtered;
  let showUpIndicator = false;
  let showDownIndicator = false;

  if (maxHeight && filtered.length > maxHeight) {
    // Center the selected index in the visible window
    const halfWindow = Math.floor(maxHeight / 2);
    let start = Math.max(0, selectedIndex - halfWindow);
    const end = Math.min(filtered.length, start + maxHeight);
    if (end === filtered.length) {
      start = Math.max(0, end - maxHeight);
    }
    visibleSessions = filtered.slice(start, end);
    showUpIndicator = start > 0;
    showDownIndicator = end < filtered.length;
  }

  return (
    <Box flexDirection="column">
      {showUpIndicator ? (
        <Box paddingX={1}><Text dimColor>▲ more</Text></Box>
      ) : null}
      {visibleSessions.map((session) => {
        const actualIndex = sessions.indexOf(session);
        const isSelected = actualIndex === selectedIndex;
        const indicator = isSelected ? "▸" : " ";
        const dot = statusDot(session.status);
        const label = statusLabel(session.status);
        const branch = extractBranch(session);
        const cwd = truncateCwd(session.cwd);

        return (
          <Box key={session.target} gap={1} paddingX={1}>
            <Text dimColor={dimmed}>{indicator}</Text>
            <Text dimColor={dimmed} color={dimmed ? "yellow" : undefined}>{dot}</Text>
            <Text bold dimColor={dimmed}>{session.sessionName}</Text>
            <Text dimColor>{label}</Text>
            {branch ? <Text color="cyan" dimColor={dimmed}>{branch}</Text> : null}
            <Text dimColor>{cwd}</Text>
            <Text dimColor>{session.command}</Text>
          </Box>
        );
      })}
      {showDownIndicator ? (
        <Box paddingX={1}><Text dimColor>▼ more</Text></Box>
      ) : null}
    </Box>
  );
}
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/session-list.test.tsx`
Expected: PASS (both new and existing tests)

**Step 5: Commit**
`git commit -m "feat: add height constraint and search filtering to SessionList"`

---

### Task 5: Search input component

**Files:**
- Create: `src/components/search-input.tsx`
- Test: `src/__tests__/search-input.test.tsx`

**Step 1: Write failing test**

```typescript
// src/__tests__/search-input.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { SearchInput } from "../components/search-input.js";

describe("SearchInput", () => {
  it("renders search prompt with query", () => {
    const { lastFrame } = render(
      <SearchInput query="arc" onChange={() => {}} onCancel={() => {}} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("/");
    expect(output).toContain("arc");
  });

  it("renders empty search prompt", () => {
    const { lastFrame } = render(
      <SearchInput query="" onChange={() => {}} onCancel={() => {}} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("/");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/search-input.test.tsx`
Expected: FAIL

**Step 3: Implement**

```tsx
// src/components/search-input.tsx
import { Box, Text, useInput } from "ink";

export interface SearchInputProps {
  query: string;
  onChange: (query: string) => void;
  onCancel: () => void;
  isActive?: boolean;
}

export function SearchInput({ query, onChange, onCancel, isActive = true }: SearchInputProps) {
  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.return) {
        // Enter dismisses search bar but keeps filter active
        return;
      }
      if (key.backspace || key.delete) {
        onChange(query.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      if (key.tab) return;

      if (input) {
        onChange(query + input);
      }
    },
    { isActive },
  );

  return (
    <Box paddingX={1} gap={1}>
      <Text color="cyan">/</Text>
      <Text>{query}</Text>
      <Text dimColor>_</Text>
    </Box>
  );
}
```

**Step 4: Export from index.ts**

Add to `src/components/index.ts`:
```typescript
export { SearchInput } from "./search-input.js";
export type { SearchInputProps } from "./search-input.js";
```

**Step 5: Verify**
Run: `npx vitest run src/__tests__/search-input.test.tsx`
Expected: PASS

**Step 6: Commit**
`git commit -m "feat: add SearchInput component for session filtering"`

---

### Task 6: Notification feed with height constraint

**Files:**
- Modify: `src/components/notification-feed.tsx`
- Modify: `src/__tests__/notification-feed.test.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/notification-feed.test.tsx`:
```typescript
describe("NotificationFeed with height constraint", () => {
  it("limits displayed events to maxHeight", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createNotification(`session${i}`, `event ${i}`)
    );
    const { lastFrame } = render(
      <NotificationFeed events={events} maxHeight={3} />
    );
    const output = lastFrame() ?? "";
    const lines = output.split("\n").filter(l => l.includes("⚡"));
    expect(lines.length).toBeLessThanOrEqual(3);
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/notification-feed.test.tsx`
Expected: FAIL — `maxHeight` prop doesn't exist

**Step 3: Implement**

Update `NotificationFeedProps`:
```typescript
export interface NotificationFeedProps {
  events: NotificationEvent[];
  maxDisplay?: number;
  maxHeight?: number;
}
```

In the component, use `maxHeight` to limit the number of visible events (each event is 1 line):
```typescript
export function NotificationFeed({
  events,
  maxDisplay = 5,
  maxHeight,
}: NotificationFeedProps) {
  if (events.length === 0) return null;

  const limit = maxHeight ? Math.min(maxDisplay, maxHeight) : maxDisplay;
  const displayed = events.slice(0, limit);
  // ...rest unchanged
}
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/notification-feed.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add maxHeight constraint to NotificationFeed"`

---

### Task 7: Wire fullscreen layout into app.tsx

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/__tests__/app.test.tsx`

This is the integration task that wires everything together.

**Step 1: Implementation**

Major changes to `src/app.tsx`:

1. Add `useStdout` import and get terminal dimensions:
```typescript
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { calculateZoneHeights, calculateFocusHeight } from "./layout.js";
import { Header } from "./components/header.js";
import { SearchInput } from "./components/search-input.js";
```

2. Add search state and layout mode awareness:
```typescript
const { stdout } = useStdout();
const rows = (stdout?.rows ?? 40) - 1;
const heights = calculateZoneHeights(rows);
const focusHeight = calculateFocusHeight(rows);

const [searchQuery, setSearchQuery] = useState("");
const [searchActive, setSearchActive] = useState(false);
```

3. Replace root `<Box>` with height binding:
```tsx
<Box flexDirection="column" height={rows}>
```

4. Replace inline header + warning banners with `<Header>`:
```tsx
<Header
  sessionCount={count}
  activeCount={activeCount}
  degraded={degraded}
  socketAvailable={server !== null}
  focusSession={uiMode.kind === "expanded-detail" ? selectedSession?.target : undefined}
/>
```

5. Remove the Zone 0 warning banner JSX (lines 403-419 in current app.tsx)

6. Remove the inline header JSX (lines 422-431)

7. Add `maxHeight` to SessionList zone, wrap in height-constrained Box:
```tsx
{uiMode.kind !== "expanded-detail" ? (
  <Box borderStyle="single" flexDirection="column" height={heights.session + 2}>
    {searchActive ? (
      <SearchInput
        query={searchQuery}
        onChange={setSearchQuery}
        onCancel={() => { setSearchQuery(""); setSearchActive(false); }}
      />
    ) : null}
    <SessionList
      sessions={sessions}
      selectedIndex={selectedIndex}
      dimmed={degraded}
      maxHeight={searchActive ? heights.session - 1 : heights.session}
      searchQuery={searchQuery || undefined}
    />
  </Box>
) : null}
```

8. Add height to detail panel Box:
```tsx
<Box borderStyle="single" flexDirection="column"
  height={uiMode.kind === "expanded-detail" ? focusHeight : heights.detail + 2}>
  <DetailPanel ... visibleLines={uiMode.kind === "expanded-detail" ? focusHeight - 2 : undefined} />
</Box>
```

9. Add height to notifications zone (separate Box, only in Overview):
```tsx
{uiMode.kind !== "expanded-detail" && notifications.length > 0 ? (
  <Box borderStyle="single" flexDirection="column" height={heights.notify + 2}>
    <NotificationFeed events={notifications} maxHeight={heights.notify} />
  </Box>
) : null}
```

10. Remove border from command input (save 2 rows), or keep minimal:
```tsx
<Box paddingX={0}>
  <CommandInput ... />
</Box>
```

11. Add `/` keybinding in overview mode:
```typescript
// In the main useInput handler (overview mode)
if (input === "/") {
  setSearchActive(true);
  return;
}
```

12. Make `j/k` context-sensitive — they already are because of `isActive` props on `useInput` handlers. Overview mode handler handles session navigation, expanded-detail handler handles scrollback scrolling.

**Step 2: Update app test**

Update `src/__tests__/app.test.tsx` to account for:
- `useStdout` mock (provide rows/columns)
- New Header component rendering
- No more warning banner as separate zone

**Step 3: Verify**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 4: Commit**
`git commit -m "feat: wire fullscreen layout with proportional zones and search"`

---

### Task 8: Final integration verification

**Files:**
- No new files

**Step 1: Run full test suite**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 2: Build check**
Run: `npm run build`
Expected: Compiles without errors

**Step 3: Manual smoke test**
Run: `npx tsx src/index.tsx`
Expected:
- Terminal enters alternate screen (clean fullscreen)
- Header shows at top with session count + time
- Session list occupies ~20% with scroll indicators if many sessions
- Detail panel occupies ~60% with conversation preview
- Notifications occupy ~20% as separate zone
- Command input at bottom
- `q` exits cleanly, terminal restored (no artifacts)
- `Ctrl-E` switches to Focus mode (detail fills screen)
- `Esc` returns to Overview
- `/` opens search, filters sessions, `Esc` clears

**Step 4: Commit**
`git commit -m "feat: layout redesign complete — fullscreen, layout modes, search"`
