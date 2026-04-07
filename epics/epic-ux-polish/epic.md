# Epic: UX Polish

## Context

gmux v1.0/v1.1 uses index-based selection which breaks when the session list is filtered (search). Status dots have no color coding, making it hard to glance at the dashboard from a distance. The search bar lacks visual distinction and match feedback.

## Goals

1. Replace index-based selection with identity-based (selectedTarget: string)
2. Fix search mode bugs (disappearing indicator, no navigation while searching)
3. Add per-status color coding to session list dots
4. Add selected row background highlight
5. Add urgency-based colors to notification feed

## Features

- **ux-identity-selection** (fr-ux-001) — foundational refactor, all navigation depends on this
- **ux-search-visual** (fr-ux-002) — inverse bar, match count, j/k in search, Enter/Esc behavior
- **ux-status-colors** (fr-ux-003) — green/dim/yellow/red-dim per status
- **ux-row-highlight** (fr-ux-004) — gray background on selected row
- **ux-notification-colors** (fr-ux-005) — yellow/green/dim-red per event type

## Spec Reference

specs/details/ux-polish.xml (fr-ux-001 through fr-ux-005)
