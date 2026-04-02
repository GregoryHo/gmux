# Epic: Hook Integration (v1.2)

## Context

gmux ships hook scripts (gmux-status.sh, gmux-notify.sh) for Claude Code to push events via the Unix socket. These scripts have a bug: they use $TMUX_PANE (which gives pane ID like %5) instead of the session:window.pane target that gmux expects. Additionally, there's no Notification event hook for instant needs_attention detection, no startup detection of whether hooks are configured, and no automated setup command.

## Goals

1. Fix hook scripts to use tmux display-message for correct session/pane extraction
2. Add Notification hook for instant needs_attention status
3. Detect hook configuration at startup, show warning if missing
4. Provide --setup-hooks CLI command for one-time global installation

## Features

- **hooks-fix-scripts** (fr-hooks-001) — fix $TMUX_PANE bug in existing scripts
- **hooks-notification** (fr-hooks-002) — new gmux-attention.sh for Notification event
- **hooks-detection** (fr-hooks-003) — startup reads ~/.claude/settings.json, checks for gmux entries
- **hooks-setup-cli** (fr-hooks-004) — gmux --setup-hooks writes hook entries, idempotent

## Spec Reference

specs/details/hooks-v2.xml (fr-hooks-001 through fr-hooks-004)
