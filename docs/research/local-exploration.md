# Local Exploration: Claude Code + tmux Integration Points

## tmux Data Available (via `list-panes -a -F`)

| Format Variable | Example | Usefulness |
|---|---|---|
| `#{session_name}` | `arcforge`, `gmux`, `workspace` | Session grouping |
| `#{window_index}.#{pane_index}` | `1.1`, `1.2` | Pane targeting |
| `#{pane_tty}` | `/dev/ttys010` | Process correlation |
| `#{pane_current_command}` | `2.1.89` (= Claude version!) | **Agent detection** |
| `#{pane_current_path}` | `/Users/gregho/GitHub/AI/gmux` | CWD |
| `#{pane_pid}` | `47885` | Process tree |
| `#{pane_active}` | `1` or `0` | Focus state |

## Key Discovery: Agent Detection via `pane_current_command`

Claude Code's process name IS its version number (e.g., `2.1.89`). Pattern: `/^\d+\.\d+\.\d+$/`

This is the simplest reliable detection — no process table scanning, no file parsing.

## Claude Code Session Data

### JSONL files: `~/.claude/projects/<project-hash>/<session-uuid>.jsonl`

Fields per message:
- `sessionId`, `type` (user/assistant), `message`, `timestamp`
- `cwd`, `gitBranch`, `version`, `entrypoint` (cli/web)
- `uuid`, `parentUuid` (conversation tree)

### Temp dir: `/tmp/claude-501/<project-hash>/<session-uuid>/`

Contains `tasks/` directory. No sockets or lock files found.

### Session env: `~/.claude/session-env/<uuid>/`

Empty directories — seems unused or cleared.

## tmux capture-pane Output

`tmux capture-pane -t <target> -p` gives the full terminal content including Claude's status line:
- Model + context window size
- Context usage % and token counts
- Cost tracking
- Git branch
- Tool usage stats
- **Activity status** (e.g., "Whisking… (1m 33s · thinking with high effort)")

## Idle Detection

`pane_activity` and `pane_idle` tmux variables appear empty in 3.6a. 
**Alternative**: Parse captured pane content for status indicators:
- "INSERT" mode = waiting for user input = idle
- "Whisking…" / "thinking" = active
- Tool execution lines = active

## Interaction via tmux

- `tmux send-keys -t <target> "message" Enter` — send input to Claude
- `tmux send-keys -t <target> C-c` — interrupt/stop Claude
- `tmux send-keys -t <target> "exit" Enter` — kill session

## Current Environment

- tmux 3.6a on macOS
- 5 active Claude Code instances across sessions
- 1 background daemon (observation agent, PID 21930)
