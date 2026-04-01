#!/usr/bin/env bash
# gmux-status.sh — Claude Code hook script (Stop event)
# Sends a status event to the gmux dashboard socket.
# Install: claude hooks add Stop --script "path/to/gmux-status.sh"
#
# Exits 0 always — must never block Claude Code.

SOCKET="/tmp/gmux.sock"

# If socket doesn't exist, exit silently
[ -S "$SOCKET" ] || exit 0

# Build the JSON payload
SESSION="${TMUX_PANE:-unknown}"
PANE="${TMUX_PANE:-unknown}"
JSON="{\"event\":\"status\",\"session\":\"${SESSION}\",\"pane\":\"${PANE}\",\"status\":\"idle\"}"

# Try to write to the socket. Use socat if available, fall back to nc.
if command -v socat >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | socat - UNIX-CONNECT:"$SOCKET" 2>/dev/null
elif command -v nc >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | nc -U "$SOCKET" 2>/dev/null
fi

exit 0
