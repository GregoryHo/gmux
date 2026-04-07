# Epic: Detail Panel Redesign (v1.2)

## Context

The current detail panel has two modes: compact JSONL conversation view and expanded scrollback snapshot (Ctrl-E). The snapshot is a one-time capture that becomes stale immediately. The user wants a live terminal mirror as the default view, with JSONL as a toggle and fallback.

## Goals

1. Default to live terminal content (capture-pane every 1s with ANSI color parsing)
2. Tab toggles between LIVE terminal and CONV (JSONL conversation)
3. Ctrl-E freezes content starting from bottom (latest first)
4. Auto-fallback to CONV when pane dies
5. Mode indicator in header ([LIVE], [CONV], [LIVE ⏸], [CONV ⏸])

## Dependencies

- **ux-identity-selection** (from epic-ux-polish) — live capture timer uses selectedTarget to know which pane to capture
- **v1.1-jsonl-reader** (completed) — CONV mode reuses existing JSONL reading logic

## Features

- **detail-live-source** (fr-detail-001) — capture-pane -e -p every 1s, ANSI parsing, auto-scroll to bottom
- **detail-conv-toggle** (fr-detail-002) — Tab toggles LIVE ↔ CONV, JSONL refresh on poll cycle
- **detail-freeze** (fr-detail-003) — Ctrl-E freeze from bottom, j/k + Ctrl-U/D scroll, Esc unfreeze
- **detail-auto-fallback** (fr-detail-004) — pane death → auto-switch to CONV, Tab no-op when pane gone
- **detail-mode-indicator** (fr-detail-005) — [LIVE]/[CONV]/[LIVE ⏸]/[CONV ⏸] in header

## Spec Reference

specs/details/detail-panel-v2.xml (fr-detail-001 through fr-detail-005)
