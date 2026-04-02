# Epic: Socket Protocol

## Source
- Detail: socket-protocol.xml
- Requirements: fr-socket-001, fr-socket-002, fr-socket-003

## Goal
Build the Unix socket server at `/tmp/gmux.sock` that accepts push events from Claude Code hooks using a JSON-line protocol with three event types.

## Features
1. **socket-server** — Bind socket, accept connections, buffer partial lines, parse JSON
2. **socket-events** — Validate and route three event types: status, notify, meta
3. **socket-hook-scripts** — Ship example hook scripts that check socket existence before writing

## Build Order
socket-server → socket-events → socket-hook-scripts (strictly sequential)
