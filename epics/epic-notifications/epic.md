# Epic: Notifications

## Source
- Detail: notifications.xml
- Requirements: fr-notify-001 through fr-notify-004

## Goal
Build the Notifier module: in-dashboard visual indicators, macOS native notifications with per-session cooldown, and optional sound.

## Features
1. **notify-visual** — Status dot changes + highlighted rows in session table
2. **notify-macos** — Push via osascript/terminal-notifier on status transitions
3. **notify-cooldown** — 5-minute per-session cooldown for macOS notifications
4. **notify-sound** — Optional sound from config (default: false)

## Build Order
notify-visual → notify-macos → notify-cooldown (sequential); notify-sound depends on notify-macos + foundation-config
