# Epic: Agent Detection and Status

## Source
- Detail: detection.xml
- Requirements: fr-detect-001 through fr-detect-005

## Goal
Build the TmuxPoller that discovers Claude Code panes, tracks state changes, classifies status via heuristics, and merges socket overrides.

## Features
1. **detect-agents** — Match `pane_current_command` against `/^\d+\.\d+\.\d+$/`, exclude self by PID
2. **detect-polling** — 3s interval polling with state diff (add/remove/change detection)
3. **detect-heuristics** — Classify status from capture-pane content (INSERT→idle, Whisking→active, etc.)
4. **detect-metadata** — Parse last assistant text block for detail panel snippet
5. **detect-socket-override** — Socket status takes priority over heuristics (cross-epic dep on socket-events)

## Build Order
detect-agents → detect-polling → detect-heuristics → detect-metadata (parallel with detect-socket-override, which waits for socket-events)
