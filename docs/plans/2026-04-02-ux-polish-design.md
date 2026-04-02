# gmux v1.2 — UX Polish Design

## Vision

Polish gmux's dashboard experience across four areas: live detail pane with source toggling, status color highlights, search UX bug fixes, and Claude Code hook integration. No new modules — all changes are within existing components plus one CLI command.

## Architecture Decision

### Detail Panel: Two-Dimension Mode Model

The detail panel has two independent dimensions: **Source** (what data to show) and **State** (following vs frozen).

```
                    Tab
    [LIVE terminal] ←────→ [CONV jsonl]
         │                      │
  Ctrl-E │                      │ Ctrl-E
         ▼                      ▼
    [LIVE frozen]           [CONV frozen]
         │                      │
     Esc │                      │ Esc
         ▼                      ▼
    [LIVE terminal]         [CONV jsonl]
```

**LIVE mode (default):** Captures selected pane via `capture-pane -e -p` every ~1s (selected pane only). Auto-scrolls to bottom. When pane dies, auto-switches to CONV.

**CONV mode (Tab):** Shows JSONL conversation preview (existing `readConversation`). Refreshes every poll cycle (~3s). Persists when pane dies.

**Freeze (Ctrl-E):** Snapshots current content, stops updates. Starts from **bottom** (latest content first). j/k scrolls (j=older, k=newer). Ctrl-U/D for 10-line jumps. Esc resumes following.

### Identity-Based Selection

Replace `selectedIndex: number` with `selectedTarget: string | null`. Selection resolves against the current visible (possibly filtered) list on each render:
- Target in visible list → highlight that row
- Target not in visible list → auto-select first visible row
- Visible list empty → null

Eliminates the entire class of "index vs filtered list" bugs, including the search indicator disappearing.

### Status Color Strategy

| Status | Symbol | Color | Ink prop |
|---|---|---|---|
| `active` | ● | green | `color="green"` |
| `idle` | ○ | dim | `dimColor` |
| `needs_attention` | ⚡ | yellow | `color="yellow"` |
| `unknown` | ? | red dim | `color="red" dimColor` |

Selected row gets subtle `backgroundColor="gray"`. Notification feed events colored by urgency (yellow for attention, green for completed, dim red for ended).

### Hook Detection & Setup

Startup reads `~/.claude/settings.json` to check for gmux hook entries. Missing hooks → `⚠ hooks` in header (same pattern as `⚠ tmux` / `⚠ socket`).

`gmux --setup-hooks` CLI command writes hook entries to `~/.claude/settings.json` (user scope, global). Run once, applies to all Claude Code instances.

---

## Detail Panel

### Live Terminal Source

- Captures via `tmux capture-pane -e -p -t <target>` every ~1s
- Only captures the **selected** pane — not all panes (performance)
- ANSI escape sequences preserved (`-e` flag) for colored output
- Auto-scrolls to bottom (latest content always visible)
- Independent of the 3s poller interval
- Header indicator: `[LIVE]`

### JSONL Conversation Source

- Existing `readConversation` logic, unchanged
- Refreshes every poll cycle (~3s)
- Clean "You: / AI:" structured view
- Survives pane death — persists on disk
- Header indicator: `[CONV]`

### Freeze Mode

- Ctrl-E snapshots current content (either source)
- **Starts from bottom** — `scrollOffset = max(0, totalLines - visibleLines)`
- j/k: scroll 1 line (j=up/older, k=down/newer)
- Ctrl-U/D: scroll 10 lines
- Esc: unfreeze, resume following
- Header indicator: `[LIVE ⏸]` or `[CONV ⏸]`

### Auto-Fallback

When pane dies while in LIVE mode:
1. Auto-switch source to CONV
2. Show dim indicator: "session ended"
3. JSONL conversation remains visible as last-known context

---

## Selection & Search

### Identity-Based Selection

```typescript
// Before
const [selectedIndex, setSelectedIndex] = useState(0);

// After
const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
```

Resolution on each render:
1. Compute visible sessions (filtered if search active)
2. Find `selectedTarget` in visible list
3. If found → that row is selected
4. If not found → select first visible row, update `selectedTarget`
5. If list empty → `selectedTarget = null`

j/k navigation: find current position in visible list, move ±1, update `selectedTarget`.

### Search UX Fixes

| Issue | Fix |
|---|---|
| Indicator disappears | Identity-based selection resolves against filtered list |
| No visual distinction | Search bar gets `inverse` background: white-on-cyan |
| No match feedback | Show count: `/ arc  2/5` |
| Can't j/k while searching | Enable j/k navigation within filtered results |
| Enter | Accepts search — keeps filter, exits input mode |
| Esc | Clears filter entirely, returns to full list |

Entering search resets selection to first filtered result.

---

## Status Colors & Visual Polish

### Session List

Status dots get per-status colors (green/dim/yellow/red-dim). Selected row gets `backgroundColor="gray"`.

### Notification Feed

Event color by type:
| Event | Color |
|---|---|
| needs input / attention | yellow |
| finished / completed | green |
| session ended / killed | dim red |
| default | dim |

### Detail Panel Mode Indicator

Appended to metadata header line:
```
arcforge:1.1 · Claude 2.1.87 · Opus 4.6 · 27% ctx  [LIVE]
arcforge:1.1 · Claude 2.1.87 · Opus 4.6 · 27% ctx  [CONV]
arcforge:1.1 · Claude 2.1.87 · Opus 4.6 · 27% ctx  [LIVE ⏸]
```

---

## Hook Integration

### Bug Fix

Replace broken `$TMUX_PANE` in both hook scripts:
```bash
# Before (broken — gives pane ID like %5)
SESSION="${TMUX_PANE:-unknown}"
PANE="${TMUX_PANE:-unknown}"

# After (correct — gives session name and window.pane target)
SESSION="$(tmux display-message -p '#{session_name}' 2>/dev/null || echo unknown)"
PANE="$(tmux display-message -p '#{window_index}.#{pane_index}' 2>/dev/null || echo unknown)"
```

### Startup Detection

1. Read `~/.claude/settings.json`
2. Look for `hooks.Stop` entries referencing gmux scripts or `/tmp/gmux.sock`
3. Pass `hooksConfigured: boolean` into `<App>`
4. Header shows `⚠ hooks` (yellow) when missing

### `gmux --setup-hooks` Command

1. Parse CLI args before Ink render
2. Read `~/.claude/settings.json` (create if absent)
3. Add `Stop` hook entries pointing to absolute paths of shipped scripts
4. Preserve existing settings
5. Idempotent — running twice doesn't duplicate entries
6. Print confirmation and exit

---

## Error Handling

No new failure domains. All changes fit existing patterns:

| Change | Failure mode | Handling |
|---|---|---|
| Live capture | Pane gone | Auto-switch to CONV, notification "session ended" |
| Live capture | tmux unreachable | Same degraded mode as poller |
| Hook detection | settings.json missing | Treat as "hooks not configured" |
| `--setup-hooks` | Write fails | Print error, exit 1. Never corrupt existing file |
| Identity selection | Session disappears | Auto-select first visible |

---

## Testing

| Area | Test type | Key scenarios |
|---|---|---|
| Live capture interval | Unit | Timer fires → capture called for selected pane only. Pane change → old timer cleared |
| Source toggle (Tab) | Unit | Tab toggles LIVE ↔ CONV. Pane death in LIVE → auto CONV |
| Freeze (Ctrl-E) | Unit | Starts from bottom offset. j/k adjusts. Esc resumes |
| Identity selection | Unit | Survives filter. Missing target → first visible. Empty → null |
| Search match count | Component | `/ arc  2/5` renders. Query change → selection resets |
| Status dot colors | Component | active→green, idle→dim, attention→yellow, unknown→red dim |
| Hook detection | Unit | With hooks → true. Missing file → false. Malformed → false |
| `--setup-hooks` | Integration | Writes entries. Preserves existing. Idempotent |
| Hook scripts | Integration | tmux display-message returns correct values. Socket receives valid JSON |

Extend existing test files. New test file only for `--setup-hooks` CLI logic.

---

<!-- REFINER_INPUT_START -->

## Requirements for Refiner

### Functional Requirements

- REQ-F019: Detail panel LIVE mode — capture-pane -e -p every 1s (hardcoded) for selected pane, auto-scroll to bottom. ANSI escape sequences parsed into Ink colored Text components (not stripped)
- REQ-F020: Detail panel CONV mode — JSONL conversation preview via existing readConversation, refreshes every poll cycle
- REQ-F021: Tab toggles detail source between LIVE and CONV
- REQ-F022: Ctrl-E freezes detail content (either source), starts from bottom, j/k + Ctrl-U/D scroll, Esc unfreezes
- REQ-F023: Auto-fallback — pane dies in LIVE mode → switch to CONV with "session ended" indicator
- REQ-F024: Identity-based selection — track selectedTarget (string) instead of selectedIndex (number)
- REQ-F025: Selection resolves against visible (filtered) list, auto-selects first visible when target missing
- REQ-F026: Search visual — inverse background, match count (N/M), j/k navigates filtered results
- REQ-F027: Search Enter accepts filter (keeps filter, exits input), Esc clears filter entirely
- REQ-F028: Status dot colors — active=green, idle=dim, needs_attention=yellow, unknown=red-dim
- REQ-F029: Selected row background highlight (gray)
- REQ-F030: Notification feed urgency colors — yellow for attention, green for completed, dim red for ended
- REQ-F031: Detail panel mode indicator in header ([LIVE], [CONV], [LIVE ⏸], [CONV ⏸])
- REQ-F032: Hook detection at startup — read ~/.claude/settings.json, check for gmux hook entries
- REQ-F033: Header warning ⚠ hooks when hooks not configured
- REQ-F034: gmux --setup-hooks CLI command — writes Stop + Notification hook entries to ~/.claude/settings.json (user scope)
- REQ-F035: Fix hook scripts — replace $TMUX_PANE with tmux display-message for correct session/pane target
- REQ-F036: Notification hook — Claude Code Notification event sends needs_attention status via socket for instant detection

### Non-Functional Requirements

- REQ-N009: Live capture only for selected pane (not all panes) to minimize tmux overhead
- REQ-N010: --setup-hooks is idempotent and preserves existing settings.json content
- REQ-N011: No new test files except for --setup-hooks CLI logic

### Constraints

- capture-pane -e preserves ANSI escape sequences — must be parsed into Ink Text color props (use ansi-sequence-parser or ink-ansi)
- Live capture interval hardcoded at 1s — not configurable (YAGNI)
- Identity-based selection changes the j/k navigation contract — all useInput handlers must be updated
- --setup-hooks must resolve script paths to absolute based on gmux install location
- Hook scripts depend on tmux display-message being available (requires running inside tmux)

<!-- REFINER_INPUT_END -->
