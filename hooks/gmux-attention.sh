#!/usr/bin/env bash
# gmux-attention.sh — Claude Code hook script (Notification event)
# Sends a needs_attention status to the gmux dashboard socket.
# Install: claude hooks add Notification --script "path/to/gmux-attention.sh"
#
# Exits 0 always — must never block Claude Code.

SOCKET="/tmp/gmux.sock"

# If socket doesn't exist, exit silently
[ -S "$SOCKET" ] || exit 0

# Extract session and pane from tmux
SESSION="$(tmux display-message -p '#{session_name}' 2>/dev/null || echo unknown)"
PANE="$(tmux display-message -p '#{window_index}.#{pane_index}' 2>/dev/null || echo unknown)"

JSON="{\"event\":\"status\",\"session\":\"${SESSION}\",\"pane\":\"${PANE}\",\"status\":\"needs_attention\"}"

# Try to write to the socket. Use socat if available, fall back to nc.
if command -v socat >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | socat - UNIX-CONNECT:"$SOCKET" 2>/dev/null
elif command -v nc >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | nc -U "$SOCKET" 2>/dev/null
fi

exit 0
