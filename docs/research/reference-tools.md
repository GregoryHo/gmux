# Reference Tools Research

## 1. cmux (manaflow-ai/cmux) — 11.9k stars

**Approach**: Native macOS terminal app that **replaces** tmux/iTerm entirely.

- **Tech**: Swift + AppKit + libghostty (GPU-accelerated terminal rendering)
- **Detection**: Env vars (`CMUX_WORKSPACE_ID`, `CMUX_SOCKET_PATH`) + OSC escape sequences
- **IPC**: Unix socket at `/tmp/cmux.sock`, JSON-RPC protocol
- **Key features**: Vertical sidebar showing branch/PR/ports/notifications, browser panes, Claude Teams support
- **Philosophy**: "Primitives, not solutions" — provides building blocks
- **Not a tmux wrapper** — it IS the terminal

## 2. dmux (standardagents/dmux) — 1.3k stars

**Approach**: React + Ink TUI that uses **tmux as its backend**.

- **Tech**: TypeScript + React Ink, runs as TUI sidebar inside tmux
- **Detection**: Agent registry in `agentLaunch.ts` mapping agent IDs to binary paths + prompt transport types
- **Status monitoring**: `tmux capture-pane` → PaneAnalyzer → **LLM classification** (Gemini Flash/Grok Fast/GPT-4o-mini) to detect idle/active/dialog states
- **tmux role**: Process orchestration layer. One tmux session per project, panes for each agent task
- **Interaction**: Different prompt transport per agent: `positional` (Claude), `option` (OpenCode), `stdin`, `send-keys` (Cline)
- **Key feature**: Auto-creates git worktrees per task, supports 11 agents, multi-agent launch
- **TmuxService**: Centralized singleton with retry logic

## 3. Symphony (OpenAI) — 14.3k stars

**Approach**: Background daemon for **autonomous** agent orchestration. Not a dashboard.

- **Tech**: Elixir/BEAM (Erlang OTP), Apache-2.0
- **Model**: Conductor/Planner/Coder pattern. Polls Linear for tasks, dispatches Codex agents
- **Isolation**: Per-issue workspace directories
- **Not interactive** — runs headless, delivers PRs automatically
- **Key insight**: BEAM's supervision trees give process-level fault tolerance

## Comparison Matrix

| Feature | cmux | dmux | symphony | gmux (proposed) |
|---|---|---|---|---|
| Replaces tmux? | Yes | No (uses tmux) | N/A | No (uses tmux) |
| Interactive? | Yes | Yes | No (daemon) | Yes |
| Detection | Env vars + OSC | Registry + binary scan | N/A | tmux pane_current_command |
| Status | Terminal-native | LLM-powered | N/A | Pane content parsing |
| IPC | Unix socket | tmux send-keys | Elixir messages | tmux send-keys |
| Tech | Swift/AppKit | TS/React Ink | Elixir/BEAM | TS/React Ink |
| Focus | Full terminal | Worktree mgmt | Auto-pilot | Dashboard/monitor |

## Deep Dive: dmux Detail Pane Architecture (2026-04-02)

**Live streaming, not polling:**
- Uses `tmux pipe-pane` → named pipe → `tail -f` → Server-Sent Events (incremental patches)
- Full refresh every 2s to fix patch drift
- PaneAnalyzer works on-demand (not continuous) — only when terminal content stabilizes
- Worker poll interval: 1000ms

**LLM-powered analysis (3-model race):**
- Gemini 2.5 Flash, Grok 4 Fast, GPT-4o-mini via OpenRouter — first success wins
- Content-hash caching (MD5) with 5s TTL, LRU eviction at 100 entries
- Three-stage pipeline: determineState → extractOptions → extractSummary

**No conversation abstraction:**
- Detail view always shows raw terminal content with ANSI codes
- Parsed data (agentStatus, options, summary) used only for notifications/status indicators
- No JSONL reading, no structured conversation history

**Terminated panes:**
- Worker catches "can't find pane" → emits `pane-removed` → worker shuts down
- Pane removed from UI — **no fallback display, no history**

## Key Takeaways for gmux

1. **dmux is the closest reference** — same tech stack (React + Ink), same tmux-based approach
2. **dmux's LLM-powered status detection is interesting but expensive** — gmux could use simpler heuristics by parsing Claude's status line
3. **cmux's socket IPC is elegant** but requires being the terminal — gmux can't do this since it sits alongside tmux
4. **Symphony is architecturally different** — background daemon, not a dashboard. But its Conductor pattern is interesting for future multi-agent orchestration
5. **Agent detection via tmux `pane_current_command`** matching version patterns is simpler than dmux's binary scanning approach
