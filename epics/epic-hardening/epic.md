# Epic: Error Handling and Degraded Modes

## Source
- Detail: lifecycle.xml (split — hardening subset)
- Requirements: fr-lifecycle-003, fr-lifecycle-004, fr-lifecycle-005

## Goal
Add graceful degradation for external system failures: tmux down, socket unavailable, pane disappeared. gmux never crashes due to external failure.

## Features
1. **hardening-tmux-degraded** — Banner + stale data + auto-recovery when tmux returns
2. **hardening-socket-degraded** — Polling-only mode with banner when socket fails
3. **hardening-sendkeys-failure** — Remove pane from store + notify when send-keys target is gone

## Build Order
All three are independent (each depends on a different upstream feature)
