#!/usr/bin/env bash
# gmux-notify.sh — Claude Code hook script
# Sends a notify event to the gmux dashboard socket.
# Install: claude hooks add Stop --script "path/to/gmux-notify.sh"
#
# Exits 0 always — must never block Claude Code.

SOCKET="/tmp/gmux.sock"

# If socket doesn't exist, exit silently
[ -S "$SOCKET" ] || exit 0

# Build the JSON payload
SESSION="${TMUX_PANE:-unknown}"
PANE="${TMUX_PANE:-unknown}"
MESSAGE="${1:-task completed}"
JSON="{\"event\":\"notify\",\"session\":\"${SESSION}\",\"pane\":\"${PANE}\",\"message\":\"${MESSAGE}\"}"

# Try to write to the socket. Use socat if available, fall back to nc.
if command -v socat >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | socat - UNIX-CONNECT:"$SOCKET" 2>/dev/null
elif command -v nc >/dev/null 2>&1; then
  printf '%s\n' "$JSON" | nc -U "$SOCKET" 2>/dev/null
fi

exit 0
