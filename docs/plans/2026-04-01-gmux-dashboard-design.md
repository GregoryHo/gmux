# gmux — Global Agent Dashboard Design

## Vision

A CLI dashboard that runs on a second monitor, providing a bird's-eye view of all AI agent instances running in tmux. Observe status, receive notifications, send quick responses, and manage sessions — without leaving your deep-work flow on the main monitor.

## Architecture Decision

**gmux is a tmux client, not a wrapper.** It does not own or replace tmux — it reads tmux state via polling, receives push events via a Unix socket, and sends commands back through `tmux send-keys` / `tmux new-session`. All tmux sessions remain independent and survive gmux restarts or crashes.

**Tech stack:** TypeScript + React + Ink (TUI framework) + Vitest

**Agent detection (Phase 1 — Claude Code only):** `pane_current_command` matching `/^\d+\.\d+\.\d+$/` — Claude Code's process name is its version number.

**Status detection: Hybrid (heuristic + socket override)**
1. Socket push (highest priority) — Claude Code hooks send status directly
2. Pane content heuristics (fallback) — parse `tmux capture-pane` output for known patterns
3. Unknown — show `?` when no signal matches

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   gmux process                        │
│                                                       │
│  ┌──────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │ TmuxPoller│──▶│ SessionStore │◀──│ SocketServer │  │
│  │ (3s tick) │   │ (state hub)  │   │ /tmp/gmux.sock│ │
│  └──────────┘   └──────┬───────┘   └──────────────┘  │
│                         │                              │
│            ┌────────────┼────────────┐                │
│            ▼            ▼            ▼                │
│     ┌──────────┐ ┌───────────┐ ┌──────────┐         │
│     │ Dashboard │ │ Notifier  │ │ Commander│         │
│     │ (Ink UI)  │ │ (macOS +  │ │ (tmux    │         │
│     │           │ │  in-app)  │ │  send-keys│        │
│     └──────────┘ └───────────┘ └──────────┘         │
└──────────────────────────────────────────────────────┘
```

| Module | Responsibility |
|---|---|
| **TmuxPoller** | Runs `tmux list-panes -a -F` every ~3s, parses output, detects agents by version pattern, captures pane content for status heuristics |
| **SocketServer** | Listens on `/tmp/gmux.sock` for push events (status updates, notifications from Claude Code hooks). JSON-line protocol |
| **SessionStore** | Central React state — merges poller data + socket events, tracks session list, status, history. Single source of truth |
| **Dashboard** | Ink components — session table, status indicators, input field, notification area |
| **Commander** | Translates UI actions → tmux commands: `send-keys`, `new-session`, `kill-session`, `switch-client` |
| **Notifier** | Emits macOS native notifications (`terminal-notifier` or `osascript`) + optional sound. Configurable per event type |

---

## Components

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  gmux — 5 sessions · 3 agents active          12:34 PM │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SESSION        STATUS    BRANCH            CWD    DUR  │
│ ▸ arcforge      ● active  feat/dashboard*   ~/G/A  2h   │
│   workspace:1   ● active  main              ~/W/P  45m  │
│   workspace:2   ○ idle    fix/auth          ~/W/P  30m  │
│   settings      ○ idle    feat/dashboard*   ~/G/d  1h   │
│   gmux          ● active  HEAD              ~/G/A  15m  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  arcforge:1.1 — Claude 2.1.87 · Opus 4.6 · 27% ctx    │
│  Last: "I'll update the hook configuration now..."      │
│                                                         │
│  ⚡ workspace:1 completed plan — proceed?    2m ago     │
│  ⚡ settings needs input — permission dialog  5m ago    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ❯ _                                                    │
└─────────────────────────────────────────────────────────┘
```

### Three Zones

| Zone | Component | Description |
|---|---|---|
| **Top: Session Table** | `<SessionList>` | Navigable rows. Each row = one detected agent pane. Shows session name, status dot, git branch, truncated cwd, duration. Arrow keys to select |
| **Middle: Detail + Notifications** | `<DetailPanel>` + `<NotificationFeed>` | Top half shows selected session's extended info (model, context %, last output snippet). Bottom half shows recent notification events with timestamps |
| **Bottom: Input** | `<CommandInput>` | Text input. Typing sends to selected pane via `tmux send-keys`. Prefix commands: `:new`, `:kill`, `:focus` |

### Key Bindings

| Key | Action |
|---|---|
| `↑/↓` or `j/k` | Navigate session list |
| `Enter` | Send typed message to selected session |
| `Ctrl-C` | Send interrupt to selected session (not quit gmux) |
| `Ctrl-K` | Kill selected session |
| `Ctrl-N` | Create new session |
| `Ctrl-F` | Focus selected session on main monitor |
| `q` or `Ctrl-Q` | Quit gmux |

### Session Creation Flow

```
Ctrl-N or :new
  → Pick project dir (from recent dirs / manual path)
  → Auto-name session from dir name
  → Select agent (phase 1: claude only)
  → tmux new-session -d -s <name> -c <dir>
  → tmux send-keys -t <name> "claude" Enter
  → poller picks up new pane on next tick
```

---

## Data Flow

### Two data paths feeding one store

```
Path 1: Polling (baseline)              Path 2: Socket (instant)
─────────────────────────              ────────────────────────
every ~3s:                              Claude Code hook fires:

tmux list-panes -a -F                   echo '{"event":"stop",
  '#{session_name}:                       "session":"arcforge",
   #{window_index}.                       "pane":"1.1",
   #{pane_index}|                         "status":"idle"}'
   #{pane_current_command}|               | socat - /tmp/gmux.sock
   #{pane_current_path}|
   #{pane_tty}|                         SocketServer:
   #{pane_pid}'                           parse JSON → validate
        │                                       │
        ▼                                       │
  TmuxPoller:                                   │
    parse → detect → diff                       │
        │                                       │
        └──────────────┐    ┌───────────────────┘
                       ▼    ▼
                 ┌──────────────┐
                 │ SessionStore │  ← single source of truth
                 └──────┬───────┘
                        │
               ┌────────┼─────────┐
               ▼        ▼         ▼
          Dashboard  Notifier  Commander
```

### Status Resolution (Hybrid C)

1. Socket says "idle"? → trust it (highest priority)
2. No socket data? → fall back to heuristic:
   - `/-- INSERT --/` → idle
   - `/Whisking|thinking/` → active
   - `/[Y\/n]|proceed\?/` → needs_attention
   - no recognized pattern → unknown (show `?`)
3. Status changed? → emit to Notifier

### State Diff Logic

Each poll cycle compares new pane list against previous:
- **New pane detected** → add to store, notification "new agent found"
- **Pane disappeared** → mark as terminated, notification "session ended"
- **Status changed** → update store. If changed to `idle` or `needs_attention` → trigger notification

### Commander Outbound

```
User types "yes" + Enter
  → Commander reads selectedSession (e.g., "arcforge:1.1")
  → spawns: tmux send-keys -t arcforge:1.1 "yes" Enter
  → optimistic UI update: show "sent" indicator

User presses Ctrl-N
  → prompt: project dir?
  → prompt: session name? (auto-suggest from dir)
  → spawns: tmux new-session -d -s <name> -c <dir>
  → spawns: tmux send-keys -t <name> "claude" Enter
  → poller picks up new pane on next tick
```

---

## Error Handling

### Four failure domains

**1. tmux not running / crashes**
- Retry once after 1s
- Still failing → dashboard shows banner: "⚠ tmux not reachable — retrying every 5s"
- Degraded mode: socket events still work, session list stale with ⚠ badge
- tmux comes back → auto-recover, clear banner

**2. Socket connection errors**
- `EADDRINUSE` → check if PID alive via `/tmp/gmux.pid`. Dead? Unlink stale socket, retry. Alive? Exit with "gmux already running"
- Other errors → log, continue without socket. Dashboard shows "⚠ socket unavailable — polling only"

**3. send-keys fails (pane gone)**
- "can't find pane" → remove from store, notify user "session ended"
- No retry — pane is gone

**4. Notification delivery fails**
- Fall back to in-dashboard only
- Don't crash, don't retry system notifications

### Lifecycle

```
startup:   write /tmp/gmux.pid → bind /tmp/gmux.sock → start poller → render
shutdown:  stop poller → close socket → unlink sock + pid → exit (never touches tmux)
```

**Key principle: gmux never kills what it doesn't own.** Unexpected crash leaves all tmux sessions untouched. Only side effect is a stale socket file, cleaned up on next startup.

---

## Testing

### Three test layers

**1. Unit tests (Vitest)**

| Module | What to test |
|---|---|
| TmuxPoller parser | Raw `list-panes` output → correct session objects. Edge cases: empty, malformed, non-agent panes filtered |
| Status heuristics | Captured pane content → correct status. Each pattern: INSERT, Whisking, [Y/n], unknown |
| Socket protocol | JSON-line input → correct event. Malformed JSON → rejected. Partial lines buffered |
| State diff | Previous + new sessions → correct adds/removes/changes |
| Commander | User action + selected session → correct tmux command string (no exec) |

**2. Integration tests (Vitest + real tmux)**

Isolated tmux server via `-L` flag:
```
beforeAll:  tmux -L gmux-test new-session -d -s test1
afterAll:   tmux -L gmux-test kill-server
```
- TmuxPoller discovers sessions on test server
- Commander send-keys reaches test pane
- new-session / kill-session works end-to-end
- Socket push event updates store

**3. Component tests (Ink render utility)**
- `<SessionList>` renders correct rows, highlights selection
- `<DetailPanel>` shows extended info
- `<NotificationFeed>` reverse chronological
- `<CommandInput>` Enter → onSubmit
- Status dots: ● active, ○ idle, ⚡ needs_attention

**Test config:** vitest workspace — `unit/` (fast, CI), `integration/` (needs tmux), `component/` (Ink render, no tmux)

---

<!-- REFINER_INPUT_START -->

## Requirements for Refiner

### Functional Requirements

- REQ-F001: Detect Claude Code instances in tmux by matching `pane_current_command` against version pattern `/^\d+\.\d+\.\d+$/`
- REQ-F002: Display session list with: tmux session name, status (active/idle/needs_attention), git branch, cwd, duration
- REQ-F003: Show detail panel for selected session: model, context %, last output snippet
- REQ-F004: Show notification feed with timestamped events
- REQ-F005: Send text messages to selected agent pane via `tmux send-keys`
- REQ-F006: Send interrupt (Ctrl-C) to selected agent pane
- REQ-F007: Create new tmux sessions: pick project dir → auto-name → launch claude
- REQ-F008: Kill tmux sessions from dashboard
- REQ-F009: Focus/switch to session on main monitor via `tmux switch-client`
- REQ-F010: macOS native notifications on status changes (idle, needs_attention, session ended)
- REQ-F011: In-dashboard visual notifications with badge/highlight
- REQ-F012: Optional sound/bell on notifications
- REQ-F013: Poll tmux every ~3s for session state
- REQ-F014: Accept push events via Unix socket at `/tmp/gmux.sock` (JSON-line protocol)
- REQ-F015: Socket events override polling heuristics (higher priority)
- REQ-F016: Status heuristics from pane content: INSERT→idle, Whisking→active, [Y/n]→needs_attention

### Non-Functional Requirements

- REQ-N001: Single process, no external daemons required
- REQ-N002: gmux crash must not affect any tmux sessions
- REQ-N003: Startup must handle stale socket/pid files from previous crash
- REQ-N004: Graceful degradation: socket fails → polling-only mode; tmux unreachable → stale data with banner
- REQ-N005: React + Ink TUI, TypeScript, Vitest test framework
- REQ-N006: Phase 1 scope: Claude Code only. Architecture supports future agent types

### Constraints

- macOS only (Phase 1) — relies on `osascript` / `terminal-notifier` for notifications
- Requires tmux 3.0+ installed and running
- Claude Code detection relies on version-as-process-name convention (may break if Claude changes this)
- Socket protocol is JSON-line (one JSON object per line, newline-delimited)

<!-- REFINER_INPUT_END -->
