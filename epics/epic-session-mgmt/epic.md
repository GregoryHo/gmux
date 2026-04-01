# Epic: Session Management

## Source
- Detail: session-management.xml
- Requirements: fr-session-001, fr-session-002

## Goal
Add session creation (fzf-style directory picker → auto-name → editable launch command) and session kill (with confirmation prompt).

## Features
1. **session-create** — Ctrl-N flow: directory picker from ~, auto-name, editable command (default "claude -c")
2. **session-kill** — Ctrl-K with "Kill session X? (y/n)" confirmation

## Build Order
session-create and session-kill are independent (both depend on ui-keybindings)
