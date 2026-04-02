# Dashboard Layout Redesign

## Vision

Redesign gmux dashboard to use fullscreen alternate screen with proportional zone layout and two layout modes (Overview / Focus). Eliminates Zone 0 by integrating warnings into the header. Separates notifications into their own zone. Adds session search.

## Architecture Decision

### Fullscreen

- **Alternate screen buffer**: `\x1b[?1049h` on entry, `\x1b[?1049l` on exit (like vim/nano)
- **Height binding**: root `<Box height={rows-1}>` via Ink's `useStdout()` (rows-1 for Ink v6 workaround)
- Signal handlers must also write the exit escape to prevent terminal corruption

### Layout Modes (replaces free resize)

Two modes instead of resizable zones — simpler interaction, covers 100% of the use case:

**Overview (default):**
```
┌──────────────────────────────────────────────────┐
│ gmux — 5 sessions · 3 active  ⚠ tmux     12:34  │ 1 行 Header (warnings integrated)
├──────────────────────────────────────────────────┤
│ 🔍 /arc_                                        │ Search (/ to trigger, hidden by default)
│ ▸ arcforge      ● active  feat/dash   ~/G/A     │
│   workspace:1   ○ idle    main        ~/W/P     │ ~20% Session List
│   settings      ⚡ attn                ~/G/d     │ (internal scroll when overflow)
├──────────────────────────────────────────────────┤
│ arcforge:1.1 · Claude 2.1.87 · Opus 4.6 · 27%  │
│ You: "fix the auth bug"                         │
│ AI:  "I'll update the middleware..."             │ ~60% Detail Panel (JSONL conversation)
│ You: "proceed"                                  │
│ AI:  "Done. Updated 3 files."                   │
├──────────────────────────────────────────────────┤
│ ⚡ workspace:1 finished — 2m ago                │
│ ⚡ settings needs input — 5m ago                │ ~20% Notifications
├──────────────────────────────────────────────────┤
│ ❯ _                                             │ 1 行 Command Input
└──────────────────────────────────────────────────┘
```

**Focus (Ctrl-E toggle):**
```
┌──────────────────────────────────────────────────┐
│ gmux — arcforge:1.1 · Full Transcript    Esc ←  │ 1 行 Header (context-aware)
├──────────────────────────────────────────────────┤
│ ▐▛███▜▌   Claude Code v2.1.87                   │
│ ⏺ Update(README.md)                             │
│   ⎿  Added 2 lines                              │ ~N 行 Full scrollback relay
│ ⏺ Bash(git commit -m "...")                     │ (j/k scroll, Ctrl-U/D page)
│   ⎿  12 files changed                           │ (capture-pane -S -)
│ ✻ Crunched for 34s                              │
├──────────────────────────────────────────────────┤
│ ❯ _                                             │ 1 行 Command Input
└──────────────────────────────────────────────────┘
```

Session list + notifications hidden. Detail takes all space.

### Height Distribution (Overview)

```
rows = stdout.rows - 1

Fixed:    Header (1) + Input (1) + borders (3) = 5 rows
Flexible: flexRows = rows - 5
          sessionHeight  = max(3, floor(flexRows * 0.20))
          notifyHeight   = max(3, floor(flexRows * 0.20))
          detailHeight   = flexRows - sessionHeight - notifyHeight  (~60%)

Focus:    focusDetailHeight = rows - Header(1) - Input(1) - border(1) = rows - 3
```

### Zone 0 Elimination

Warning states (degraded tmux, socket unavailable) integrated into Header:
- Normal: `gmux — 5 sessions · 3 active          12:34`
- Degraded: `gmux — 5 sessions · 3 active  ⚠ tmux  12:34` (yellow)
- Socket down: `gmux — 5 sessions  ⚠ socket        12:34` (yellow)

### Session Search

`/` triggers search input within the session list zone:
- Appears as first line of session list: `🔍 /query_`
- Fuzzy matches against session name
- Esc clears search and restores full list
- Does not conflict with command input (separate zone, separate `useInput`)

### Context-Sensitive j/k

| Key | Overview | Focus |
|---|---|---|
| `j/k` | Navigate session list | Scroll scrollback |
| `Ctrl-U/D` | — | Page scroll (10 lines) |

### Key Bindings (Updated)

| Key | Overview | Focus |
|---|---|---|
| `j` / `↓` | Select next session | Scroll down 1 line |
| `k` / `↑` | Select prev session | Scroll up 1 line |
| `Ctrl-D` | — | Scroll down 10 lines |
| `Ctrl-U` | — | Scroll up 10 lines |
| `/` | Open session search | — |
| `Esc` | Clear search / cancel overlay | Return to Overview |
| `Ctrl-E` | Enter Focus mode | Return to Overview |
| `Enter` | Send message | Send message |
| `Ctrl-C` | Interrupt selected session | Interrupt selected session |
| `Ctrl-K` | Kill session (confirm) | Kill session (confirm) |
| `Ctrl-N` | New session wizard | — |
| `Ctrl-F` | Focus main monitor | — |
| `q` / `Ctrl-Q` | Quit gmux | Quit gmux |

### Component Changes

**Modified:**
| Component | Changes |
|---|---|
| `app.tsx` | Root `<Box height={rows-1}>`, layout mode state, `/` keybinding, context-sensitive j/k |
| `index.tsx` | Alternate screen enter/exit escapes, signal handler cleanup |
| `session-list.tsx` | `height` prop, internal scroll, `searchQuery` prop for filtering |
| `detail-panel.tsx` | `height` prop, Focus mode `flexGrow=1` |
| `notification-feed.tsx` | `height` prop |
| Header (inline) | Merge warning states: degraded/socket → yellow + ⚠ icon |

**New:**
| Component | Purpose |
|---|---|
| `<SearchInput>` | Session list search bar, `/` trigger, Esc cancel, fuzzy match |

**Removed:**
- Zone 0 warning banner inline JSX (merged into Header)

---

<!-- REFINER_INPUT_START -->

## Requirements for Refiner

### Functional Requirements

- REQ-F019: Fullscreen mode — alternate screen buffer + height binding to terminal rows
- REQ-F020: Overview layout mode — 4 zones with proportional heights (20/60/20 split for flexible zones)
- REQ-F021: Focus layout mode — Ctrl-E toggles, detail panel takes all space, session list + notifications hidden
- REQ-F022: Warning integration in Header — degraded/socket states shown as yellow ⚠ in header, no separate zone
- REQ-F023: Session search — `/` triggers fuzzy search within session list, Esc clears
- REQ-F024: Context-sensitive j/k — navigates sessions in Overview, scrolls scrollback in Focus
- REQ-F025: Session list internal scroll — overflow sessions scroll within fixed height zone

### Non-Functional Requirements

- REQ-N007: Alternate screen must be exited on all exit paths (normal quit, SIGINT, SIGTERM, crash)
- REQ-N008: Layout proportions adapt to any terminal height (min viable: 20 rows)

### Constraints

- Ink v6 has a regression where height=rows causes extra newline — use rows-1
- Alternate screen escape sequences are terminal-specific but universally supported on modern terminals
- Focus mode reuses the existing `capture-pane -S -` scrollback capture mechanism

<!-- REFINER_INPUT_END -->
