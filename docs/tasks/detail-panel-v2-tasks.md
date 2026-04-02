# Detail Panel Redesign (v1.2) Tasks

> **Goal:** Replace static detail panel with live terminal mirror (default) + JSONL conversation toggle (Tab), freeze mode from bottom (Ctrl-E), auto-fallback on pane death, and mode indicator.
> **Architecture:** Add ANSI parser dependency. New `live-capture.ts` module for 1s interval capture. Refactor `detail-panel.tsx` to support source/state dimensions. Wire Tab keybinding in `app.tsx`.
> **Tech Stack:** React + Ink, `ansi-sequence-parser`, Vitest.

> **For Claude:** Use arc-executing-tasks to implement. **Depends on ux-polish tasks (identity selection) being completed first.**

## Context

Current detail panel has compact JSONL view (default) and expanded scrollback snapshot (Ctrl-E). The snapshot is a one-time capture that becomes stale immediately. This redesign makes the default view a live terminal mirror with ANSI color support, keeps JSONL as a toggle, and adds proper freeze-from-bottom behavior.

Design: `docs/plans/2026-04-02-ux-polish-design.md`
Spec: `specs/details/detail-panel-v2.xml`

## Tasks

### Task 1: Install ANSI parser dependency

**Files:**
- Modify: `package.json`

**Step 1: Install**
Run: `npm install ansi-sequence-parser`

**Step 2: Verify**
Run: `node -e "require('ansi-sequence-parser')"`
Expected: No error

**Step 3: Commit**
`git commit -m "deps: add ansi-sequence-parser for LIVE mode ANSI rendering"`

---

### Task 2: ANSI-to-Ink renderer module

**Files:**
- Create: `src/ansi-renderer.tsx`
- Create: `src/__tests__/ansi-renderer.test.tsx`

**Step 1: Write failing test**

```typescript
// src/__tests__/ansi-renderer.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { AnsiText } from "../ansi-renderer.js";

describe("AnsiText", () => {
  it("renders plain text without ANSI", () => {
    const { lastFrame } = render(<AnsiText text="hello world" />);
    expect(lastFrame()).toContain("hello world");
  });

  it("renders text with ANSI sequences without crashing", () => {
    // \x1b[32m = green, \x1b[0m = reset
    const ansi = "\x1b[32m✓\x1b[0m Edit(src/app.tsx)";
    const { lastFrame } = render(<AnsiText text={ansi} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("✓");
    expect(output).toContain("Edit(src/app.tsx)");
    // Should NOT contain raw escape sequences
    expect(output).not.toContain("\x1b[");
  });

  it("renders multi-line ANSI text", () => {
    const ansi = "\x1b[1mBold line\x1b[0m\nNormal line";
    const { lastFrame } = render(<AnsiText text={ansi} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Bold line");
    expect(output).toContain("Normal line");
  });

  it("handles empty string", () => {
    const { lastFrame } = render(<AnsiText text="" />);
    expect(lastFrame()).toBeDefined();
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/ansi-renderer.test.tsx`
Expected: FAIL — module doesn't exist

**Step 3: Implement**

```tsx
// src/ansi-renderer.tsx
import { Text } from "ink";
import { parseAnsiSequences, type ParseToken } from "ansi-sequence-parser";

interface AnsiSpan {
  text: string;
  color?: string;
  bgColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const COLOR_MAP: Record<number, string> = {
  30: "black", 31: "red", 32: "green", 33: "yellow",
  34: "blue", 35: "magenta", 36: "cyan", 37: "white",
  90: "gray", 91: "red", 92: "green", 93: "yellow",
  94: "blue", 95: "magenta", 96: "cyan", 97: "white",
};

const BG_COLOR_MAP: Record<number, string> = {
  40: "black", 41: "red", 42: "green", 43: "yellow",
  44: "blue", 45: "magenta", 46: "cyan", 47: "white",
};

function tokensToSpans(tokens: ParseToken[]): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let currentStyle: Omit<AnsiSpan, "text"> = {};

  for (const token of tokens) {
    if (token.type === "text") {
      spans.push({ text: token.value, ...currentStyle });
    } else if (token.type === "sgr") {
      for (const param of token.params) {
        if (param === 0) { currentStyle = {}; }
        else if (param === 1) { currentStyle.bold = true; }
        else if (param === 2) { currentStyle.dim = true; }
        else if (param === 3) { currentStyle.italic = true; }
        else if (param === 4) { currentStyle.underline = true; }
        else if (param === 22) { currentStyle.bold = false; currentStyle.dim = false; }
        else if (param === 23) { currentStyle.italic = false; }
        else if (param === 24) { currentStyle.underline = false; }
        else if (COLOR_MAP[param]) { currentStyle.color = COLOR_MAP[param]; }
        else if (param === 39) { delete currentStyle.color; }
        else if (BG_COLOR_MAP[param]) { currentStyle.bgColor = BG_COLOR_MAP[param]; }
        else if (param === 49) { delete currentStyle.bgColor; }
      }
    }
    // Ignore other escape sequences (cursor movement, etc.)
  }

  return spans;
}

export interface AnsiTextProps {
  text: string;
}

export function AnsiText({ text }: AnsiTextProps) {
  if (!text) return null;

  const tokens = parseAnsiSequences(text);
  const spans = tokensToSpans(tokens);

  return (
    <>
      {spans.map((span, i) => (
        <Text
          key={i}
          color={span.color}
          backgroundColor={span.bgColor}
          bold={span.bold}
          dimColor={span.dim}
          italic={span.italic}
          underline={span.underline}
        >
          {span.text}
        </Text>
      ))}
    </>
  );
}
```

Note: The `parseAnsiSequences` API may differ — check the library's actual exports and adjust. The core pattern is: parse tokens → map SGR params to Ink Text props.

**Step 4: Verify**
Run: `npx vitest run src/__tests__/ansi-renderer.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add ANSI-to-Ink renderer for live terminal colors"`

---

### Task 3: Live capture module

**Files:**
- Create: `src/live-capture.ts`
- Create: `src/__tests__/live-capture.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/live-capture.test.ts
import { describe, it, expect, vi } from "vitest";
import { capturePane } from "../live-capture.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn((cmd, args, cb) => {
    if (args.includes("-t") && args.includes("test:1.1")) {
      cb(null, "line1\nline2\nline3\n", "");
    } else {
      cb(new Error("can't find pane"), "", "can't find pane");
    }
  }),
}));

describe("capturePane", () => {
  it("captures pane content with ANSI escapes", async () => {
    const content = await capturePane("test:1.1");
    expect(content).toContain("line1");
    expect(content).toContain("line3");
  });

  it("returns null when pane is gone", async () => {
    const content = await capturePane("gone:1.1");
    expect(content).toBeNull();
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/live-capture.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Implement**

```typescript
// src/live-capture.ts
import { execFile } from "node:child_process";

/**
 * Capture a tmux pane's content with ANSI escape sequences preserved.
 * Returns null if the pane doesn't exist or capture fails.
 */
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
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/live-capture.test.ts`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add live-capture module for capture-pane with ANSI"`

---

### Task 4: Detail panel refactor — source/state dimensions

**Files:**
- Modify: `src/components/detail-panel.tsx`
- Modify: `src/__tests__/detail-panel.test.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/detail-panel.test.tsx`:

```typescript
describe("DetailPanel source modes", () => {
  it("renders LIVE mode with terminal content", () => {
    const session = mockSession();
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        liveContent="$ npm test\nAll tests passed"
        frozen={false}
      />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("npm test");
    expect(output).toContain("[LIVE]");
  });

  it("renders CONV mode with conversation entries", () => {
    const session = mockSession();
    const entries = [
      { role: "user" as const, text: "fix the bug", timestamp: "" },
      { role: "assistant" as const, text: "Done", timestamp: "" },
    ];
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="conv"
        conversation={entries}
        frozen={false}
      />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("fix the bug");
    expect(output).toContain("[CONV]");
  });

  it("renders frozen indicator", () => {
    const session = mockSession();
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        liveContent="content"
        frozen={true}
        scrollOffset={0}
      />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("[LIVE ⏸]");
  });

  it("shows session ended indicator when pane is gone", () => {
    const session = mockSession();
    const entries = [
      { role: "user" as const, text: "last message", timestamp: "" },
    ];
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="conv"
        conversation={entries}
        paneAlive={false}
        frozen={false}
      />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("session ended");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/detail-panel.test.tsx`
Expected: FAIL — new props don't exist

**Step 3: Implement**

Rewrite `src/components/detail-panel.tsx` with new prop interface:

```typescript
export interface DetailPanelProps {
  session: AgentSession | null;
  /** Current source mode */
  source: "live" | "conv";
  /** Whether content is frozen */
  frozen: boolean;
  /** Live terminal content (used when source is "live") */
  liveContent?: string;
  /** Conversation entries (used when source is "conv") */
  conversation?: ConversationEntry[];
  /** Scroll offset for frozen view (lines from bottom) */
  scrollOffset?: number;
  /** Visible lines count */
  visibleLines?: number;
  /** Terminal width for text wrapping */
  terminalWidth?: number;
  /** Whether the pane is still alive */
  paneAlive?: boolean;
}
```

The component renders based on `source`:
- `live`: Use `AnsiText` to render `liveContent`, auto-scroll to bottom unless frozen
- `conv`: Use existing conversation rendering logic

Header line appends mode indicator:
```tsx
function modeIndicator(source: string, frozen: boolean): string {
  const label = source === "live" ? "LIVE" : "CONV";
  return frozen ? `[${label} ⏸]` : `[${label}]`;
}
```

When `paneAlive === false`, show dim "session ended" text below content.

**Step 4: Verify**
Run: `npx vitest run src/__tests__/detail-panel.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: refactor detail panel with source/state dimensions and mode indicator"`

---

### Task 5: Wire live capture + Tab toggle + freeze into app.tsx

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/__tests__/app.test.tsx`

**Step 1: Implement**

Add new state to `app.tsx`:

```typescript
type DetailSource = "live" | "conv";

const [detailSource, setDetailSource] = useState<DetailSource>("live");
const [detailFrozen, setDetailFrozen] = useState(false);
const [liveContent, setLiveContent] = useState("");
const [frozenContent, setFrozenContent] = useState("");
```

Add live capture effect (only when source is LIVE and a pane is selected):

```typescript
useEffect(() => {
  if (detailSource !== "live" || !selectedSession) {
    return;
  }

  const tick = async () => {
    const content = await capturePane(selectedSession.target);
    if (content === null) {
      // Pane died — auto-fallback to CONV
      setDetailSource("conv");
      return;
    }
    if (!detailFrozen) {
      setLiveContent(content);
    }
  };

  void tick(); // immediate first capture
  const timer = setInterval(() => void tick(), 1000);

  return () => clearInterval(timer);
}, [selectedSession?.target, detailSource, detailFrozen]);
```

Add Tab keybinding (in normal mode, non-search):

```typescript
if (key.tab) {
  if (/* pane is alive */) {
    setDetailSource((prev) => (prev === "live" ? "conv" : "live"));
    setDetailFrozen(false);
  }
  return;
}
```

Refactor Ctrl-E to freeze/unfreeze:

```typescript
if (key.ctrl && input === "e") {
  if (detailFrozen) {
    // Unfreeze
    setDetailFrozen(false);
  } else {
    // Freeze — snapshot current content from bottom
    setFrozenContent(detailSource === "live" ? liveContent : /* serialize conv */);
    setDetailFrozen(true);
    // Set scroll offset to bottom
    const lines = (detailSource === "live" ? liveContent : "").split("\n");
    setScrollOffset(Math.max(0, lines.length - (focusHeight - 2)));
  }
  return;
}
```

Update Esc in frozen mode to unfreeze:

```typescript
if (key.escape) {
  setDetailFrozen(false);
  return;
}
```

Update DetailPanel rendering:

```tsx
<DetailPanel
  session={selectedSession}
  source={detailSource}
  frozen={detailFrozen}
  liveContent={detailFrozen ? frozenContent : liveContent}
  conversation={conversation}
  scrollOffset={scrollOffset}
  visibleLines={isExpanded ? focusHeight - 2 : heights.detail}
  terminalWidth={cols}
  paneAlive={/* check if selectedSession is still in sessions */}
/>
```

Remove the old `scrollbackContent` state and `captureFullScrollback` call from Ctrl-E (replaced by live capture).

Remove the old `expanded-detail` UIMode — freeze replaces it.

**Step 2: Update tests**

Update `src/__tests__/app.test.tsx` to account for:
- New `detailSource` and `detailFrozen` states
- Tab keybinding
- Removed `expanded-detail` UIMode

**Step 3: Verify**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 4: Commit**
`git commit -m "feat: wire live capture, Tab toggle, and freeze mode into app"`

---

### Task 6: Final integration verification

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
- Detail panel shows [LIVE] with terminal content auto-scrolling to bottom
- Tab toggles to [CONV] showing conversation preview
- Tab back to [LIVE]
- Ctrl-E freezes content, shows [LIVE ⏸], starts from bottom
- j/k scrolls frozen content
- Esc unfreezes back to [LIVE]
- When a session ends, auto-switches to [CONV] with "session ended"

**Step 4: Commit**
`git commit -m "feat: detail panel v2 complete — live terminal, CONV toggle, freeze"`
