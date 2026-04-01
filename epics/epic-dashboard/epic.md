# Epic: Dashboard UI and Interaction

## Source
- Detail: dashboard.xml
- Requirements: fr-ui-001 through fr-ui-007

## Goal
Build the three-zone Ink TUI: session list table, detail panel + notification feed, and command input with keyboard navigation.

## Features
1. **ui-session-list** — Navigable table of agent panes with status dots, branch, cwd, duration
2. **ui-detail-panel** — Extended info for selected session (model, context %, last output)
3. **ui-notification-feed** — Reverse-chronological event list with relative timestamps
4. **ui-command-input** — Text input that sends to selected pane via tmux send-keys
5. **ui-interrupt** — Ctrl-C sends interrupt to selected pane (not gmux)
6. **ui-keybindings** — j/k navigation, Enter, Ctrl-C, Ctrl-K, Ctrl-N, Ctrl-F, q
7. **ui-focus** — Switch main monitor's tmux client to selected session (client picker)

## Build Order
ui-session-list → [ui-detail-panel, ui-notification-feed, ui-command-input] → ui-interrupt → ui-keybindings → ui-focus
