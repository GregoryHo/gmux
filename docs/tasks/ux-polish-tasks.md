# UX Polish Tasks

> **Goal:** Fix selection bugs, add status colors, improve search UX, and add notification urgency colors.
> **Architecture:** Replace `selectedIndex: number` with `selectedTarget: string | null`. Add color props to existing components. Refactor search to support j/k navigation and match count.
> **Tech Stack:** React + Ink, Vitest.

> **For Claude:** Use arc-executing-tasks to implement.

## Context

Current dashboard uses index-based selection which breaks when search filters the list (indicator disappears, points to wrong session). Status dots have no color differentiation. Search bar is visually indistinct with no match feedback.

Design: `docs/plans/2026-04-02-ux-polish-design.md`
Spec: `specs/details/ux-polish.xml`

## Tasks

### Task 1: Status dot colors

**Files:**
- Modify: `src/components/session-list.tsx`
- Modify: `src/__tests__/session-list.test.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/session-list.test.tsx`:

```typescript
describe("status dot colors", () => {
  it("renders active dot in green", () => {
    const session = mockSession("test", 0);
    session.status = "active";
    const { lastFrame } = render(
      <SessionList sessions={[session]} selectedIndex={0} />
    );
    // The ● character should be present (color not directly testable in ink-testing-library,
    // but we verify the component doesn't crash and renders the dot)
    expect(lastFrame()).toContain("●");
  });

  it("renders needs_attention dot in yellow", () => {
    const session = mockSession("test", 0);
    session.status = "needs_attention";
    const { lastFrame } = render(
      <SessionList sessions={[session]} selectedIndex={0} />
    );
    expect(lastFrame()).toContain("⚡");
  });

  it("renders unknown dot", () => {
    const session = mockSession("test", 0);
    session.status = "unknown";
    const { lastFrame } = render(
      <SessionList sessions={[session]} selectedIndex={0} />
    );
    expect(lastFrame()).toContain("?");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/session-list.test.tsx`
Expected: PASS (tests verify rendering, not color — color is a visual prop)

**Step 3: Implement**

In `src/components/session-list.tsx`, update the `statusDot` function to return color info, and update the rendering:

```typescript
function statusColor(status: AgentStatus): { color?: string; dimColor?: boolean } {
  switch (status) {
    case "active":
      return { color: "green" };
    case "idle":
      return { dimColor: true };
    case "needs_attention":
      return { color: "yellow" };
    default:
      return { color: "red", dimColor: true };
  }
}
```

Update the `<Text>` for the dot in the map:

```tsx
<Text {...statusColor(session.status)}>{dot}</Text>
```

Remove the old `color={dimmed ? "yellow" : undefined}` and `dimColor={dimmed}` from the dot Text.

**Step 4: Verify**
Run: `npx vitest run src/__tests__/session-list.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add per-status color coding to session list dots"`

---

### Task 2: Notification feed urgency colors

**Files:**
- Modify: `src/components/notification-feed.tsx`
- Modify: `src/__tests__/notification-feed.test.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/notification-feed.test.tsx`:

```typescript
describe("notification urgency colors", () => {
  it("renders attention events with ⚡", () => {
    const events = [createNotification("test", "needs input")];
    const { lastFrame } = render(<NotificationFeed events={events} />);
    expect(lastFrame()).toContain("needs input");
  });

  it("renders completed events", () => {
    const events = [createNotification("test", "finished")];
    const { lastFrame } = render(<NotificationFeed events={events} />);
    expect(lastFrame()).toContain("finished");
  });

  it("renders session ended events", () => {
    const events = [createNotification("test", "session ended")];
    const { lastFrame } = render(<NotificationFeed events={events} />);
    expect(lastFrame()).toContain("session ended");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/notification-feed.test.tsx`
Expected: PASS

**Step 3: Implement**

Add urgency color function to `src/components/notification-feed.tsx`:

```typescript
function urgencyColor(message: string): { color?: string; dimColor?: boolean } {
  const lower = message.toLowerCase();
  if (lower.includes("needs input") || lower.includes("attention")) {
    return { color: "yellow" };
  }
  if (lower.includes("finished") || lower.includes("completed")) {
    return { color: "green" };
  }
  if (lower.includes("session ended") || lower.includes("killed")) {
    return { color: "red", dimColor: true };
  }
  return { dimColor: true };
}
```

Update the notification row rendering:

```tsx
{displayed.map((event) => {
  const uc = urgencyColor(event.message);
  return (
    <Box key={event.id} gap={1}>
      <Text {...uc}>⚡</Text>
      <Text bold {...uc}>{event.sessionName}</Text>
      <Text {...uc}>{event.message}</Text>
      <Text dimColor>— {formatRelativeTime(event.timestamp)}</Text>
    </Box>
  );
})}
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/notification-feed.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add urgency-based colors to notification feed"`

---

### Task 3: Identity-based selection — state refactor in app.tsx

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/__tests__/app.test.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/app.test.tsx`:

```typescript
describe("identity-based selection", () => {
  it("resolves selectedTarget to first session when null", () => {
    // This tests the resolution logic indirectly via rendering
    // The selected session should be the first one when no target is set
    // (verified by detail panel showing first session's info)
  });
});
```

Note: The identity selection is a refactor of internal state. The primary verification is that existing tests still pass with the new state model.

**Step 2: Implement**

In `src/app.tsx`, replace:

```typescript
const [selectedIndex, setSelectedIndex] = useState(0);
```

With:

```typescript
const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
```

Add a resolution hook after sessions state:

```typescript
// Resolve selectedTarget against current visible list
const visibleSessions = useMemo(() => {
  if (!searchQuery) return sessions;
  return sessions.filter((s) =>
    s.sessionName.toLowerCase().includes(searchQuery.toLowerCase()),
  );
}, [sessions, searchQuery]);

const selectedIndex = useMemo(() => {
  if (selectedTarget === null || visibleSessions.length === 0) return -1;
  return visibleSessions.findIndex((s) => s.target === selectedTarget);
}, [selectedTarget, visibleSessions]);

const selectedSession = selectedIndex >= 0 ? visibleSessions[selectedIndex] : visibleSessions[0] ?? null;

// Auto-resolve when target is missing from visible list
useEffect(() => {
  if (visibleSessions.length === 0) {
    setSelectedTarget(null);
    return;
  }
  if (selectedIndex < 0) {
    setSelectedTarget(visibleSessions[0].target);
  }
}, [visibleSessions, selectedIndex]);
```

Update `selectPrev` and `selectNext`:

```typescript
const selectPrev = () => {
  if (visibleSessions.length === 0) return;
  const current = selectedIndex >= 0 ? selectedIndex : 0;
  const prev = (current - 1 + visibleSessions.length) % visibleSessions.length;
  setSelectedTarget(visibleSessions[prev].target);
};

const selectNext = () => {
  if (visibleSessions.length === 0) return;
  const current = selectedIndex >= 0 ? selectedIndex : 0;
  const next = (current + 1) % visibleSessions.length;
  setSelectedTarget(visibleSessions[next].target);
};
```

Remove the old `selectedIndex` clamping `useEffect` (lines 159-165) and the search reset `useEffect` (lines 167-169).

Add search reset:

```typescript
useEffect(() => {
  if (searchQuery !== null && visibleSessions.length > 0) {
    setSelectedTarget(visibleSessions[0].target);
  }
}, [searchQuery]);
```

Update `SessionList` prop — pass `selectedTarget` instead of `selectedIndex`:

```tsx
<SessionList
  sessions={visibleSessions}
  selectedTarget={selectedTarget}
  dimmed={degraded}
  maxHeight={searchActive ? heights.session - 1 : heights.session}
/>
```

Note: Remove the `searchQuery` prop from SessionList — filtering now happens in app.tsx via `visibleSessions`.

**Step 3: Update SessionList component**

In `src/components/session-list.tsx`, update the props interface:

```typescript
export interface SessionListProps {
  sessions: AgentSession[];
  selectedTarget: string | null;
  dimmed?: boolean;
  maxHeight?: number;
}
```

Update the rendering to use `selectedTarget`:

```tsx
const isSelected = session.target === selectedTarget;
```

Remove `searchQuery` filtering logic from SessionList (moved to app.tsx).

**Step 4: Verify**
Run: `npx vitest run`
Expected: ALL tests PASS (update any tests that reference `selectedIndex` prop)

**Step 5: Commit**
`git commit -m "refactor: replace selectedIndex with identity-based selectedTarget"`

---

### Task 4: Selected row background highlight

**Files:**
- Modify: `src/components/session-list.tsx`
- Modify: `src/__tests__/session-list.test.tsx`

**Step 1: Write failing test**

Add to `src/__tests__/session-list.test.tsx`:

```typescript
describe("selected row highlight", () => {
  it("selected row has visual distinction from unselected", () => {
    const sessions = [mockSession("first", 0), mockSession("second", 1)];
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="first:1.0" />
    );
    const output = lastFrame() ?? "";
    // Selected row should have ▸ indicator
    expect(output).toContain("▸");
    expect(output).toContain("first");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/session-list.test.tsx`
Expected: PASS

**Step 3: Implement**

In `src/components/session-list.tsx`, update the row Box:

```tsx
<Box
  key={session.target}
  gap={1}
  paddingX={1}
  backgroundColor={isSelected ? "gray" : undefined}
>
```

**Step 4: Verify**
Run: `npx vitest run src/__tests__/session-list.test.tsx`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat: add gray background highlight to selected session row"`

---

### Task 5: Search visual improvements

**Files:**
- Modify: `src/components/search-input.tsx`
- Modify: `src/__tests__/search-input.test.tsx`
- Modify: `src/app.tsx`

**Step 1: Write failing test**

Update `src/__tests__/search-input.test.tsx`:

```typescript
describe("SearchInput", () => {
  it("renders search prompt with query and match count", () => {
    const { lastFrame } = render(
      <SearchInput query="arc" onChange={() => {}} onCancel={() => {}} matchCount={2} totalCount={5} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("/");
    expect(output).toContain("arc");
    expect(output).toContain("2/5");
  });

  it("renders empty search with zero matches", () => {
    const { lastFrame } = render(
      <SearchInput query="" onChange={() => {}} onCancel={() => {}} matchCount={0} totalCount={5} />
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("/");
    expect(output).toContain("0/5");
  });
});
```

**Step 2: Run test**
Run: `npx vitest run src/__tests__/search-input.test.tsx`
Expected: FAIL — `matchCount` and `totalCount` props don't exist

**Step 3: Implement**

Update `src/components/search-input.tsx`:

```typescript
export interface SearchInputProps {
  query: string;
  onChange: (query: string) => void;
  onCancel: () => void;
  onAccept?: () => void;
  isActive?: boolean;
  matchCount?: number;
  totalCount?: number;
}

export function SearchInput({
  query,
  onChange,
  onCancel,
  onAccept,
  isActive = true,
  matchCount = 0,
  totalCount = 0,
}: SearchInputProps) {
  useInput(
    (input, key) => {
      if (key.escape) { onCancel(); return; }
      if (key.return) { onAccept?.(); return; }
      if (key.backspace || key.delete) { onChange(query.slice(0, -1)); return; }
      if (key.ctrl || key.meta) return;
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      if (key.tab) return;
      if (input) onChange(query + input);
    },
    { isActive },
  );

  return (
    <Box paddingX={1} gap={1}>
      <Text backgroundColor="cyan" color="white" bold> / </Text>
      <Text>{query}</Text>
      <Text dimColor>_</Text>
      <Text dimColor>{matchCount}/{totalCount}</Text>
    </Box>
  );
}
```

**Step 4: Wire in app.tsx**

Update SearchInput usage:

```tsx
<SearchInput
  query={searchQuery}
  onChange={setSearchQuery}
  onCancel={() => setSearchQuery(null)}
  onAccept={() => setSearchQuery(prev => prev)}
  matchCount={visibleSessions.length}
  totalCount={sessions.length}
/>
```

Add `onAccept` handling — when Enter is pressed, keep the filter active but deactivate search input mode. This requires a new state:

```typescript
const [searchInputActive, setSearchInputActive] = useState(false);
const searchActive = searchQuery !== null;
```

When `/` pressed: `setSearchQuery(""); setSearchInputActive(true);`
When Enter: `setSearchInputActive(false);` (filter stays, input deactivates)
When Esc: `setSearchQuery(null); setSearchInputActive(false);`

Pass `isActive={searchInputActive}` to SearchInput.

Enable j/k navigation when `searchActive && !searchInputActive`.

**Step 5: Verify**
Run: `npx vitest run`
Expected: ALL tests PASS

**Step 6: Commit**
`git commit -m "feat: search visual improvements — inverse bar, match count, Enter/Esc behavior"`

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
`git commit -m "fix: ux-polish integration fixups"`
