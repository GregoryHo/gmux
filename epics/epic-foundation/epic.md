# Epic: Project Foundation

## Source
- Detail: lifecycle.xml (split — foundational subset)
- Requirements: fr-lifecycle-007, fr-lifecycle-006, fr-lifecycle-001, fr-lifecycle-002

## Goal
Set up the TypeScript + React + Ink project, configuration loader, and process lifecycle (startup/shutdown with PID and socket management).

## Features
1. **foundation-tech-stack** — Project scaffolding: package.json, tsconfig, vitest config, Ink entry point
2. **foundation-config** — Load `~/.config/gmux/config.json` with defaults fallback
3. **foundation-startup** — Write PID file, bind socket, handle stale files from previous crash
4. **foundation-shutdown** — Signal handlers (SIGINT/SIGTERM), cleanup socket + PID, exit cleanly

## Build Order
tech-stack → config → startup → shutdown (strictly sequential)
