# Research: Scaled Canvas Rendering for Detail Panel

## Problem

When the source tmux pane is wider than the gmux detail panel, the captured content doesn't display well:
- **Wrap** at panel width: breaks terminal layout (tables, status bars, box-drawing)
- **Truncate** at panel width: loses right-side content
- Neither option is satisfactory for a monitoring dashboard

## Idea: Treat Terminal Content as a Canvas

Render the captured pane as a scaled-down image/bitmap, similar to how image viewers scale photos to fit a container. The terminal content at 200 columns would be proportionally scaled to fit 130 columns.

## Approaches

### 1. Terminal Image Protocols (Most Promising)

Modern terminals support inline image display:
- **Sixel** — Widely supported (xterm, mlterm, WezTerm, foot, Ghostty)
- **Kitty Graphics Protocol** — Kitty, WezTerm, Ghostty
- **iTerm2 Inline Images** — iTerm2, WezTerm

**Flow:**
1. Capture pane content (ANSI text)
2. Render ANSI text to a bitmap using a headless terminal renderer
3. Scale the bitmap to panel width (maintaining aspect ratio)
4. Encode as Sixel/Kitty/iTerm2 and output as inline image

**Headless terminal rendering options:**
- `vte` / `xterm.js` in headless mode → canvas → PNG
- `ansi-to-svg` → SVG → PNG (via sharp/canvas)
- `textimg` CLI tool (Go) — renders ANSI to PNG directly
- Custom: parse ANSI tokens → render to node-canvas at source width → scale

**Pros:** True proportional scaling, preserves all layout and colors
**Cons:** Terminal-dependent, non-interactive (can't select text), requires image rendering pipeline

### 2. Unicode Braille Characters (Low-Res Thumbnail)

Each braille character (⠀ to ⣿) represents a 2×4 dot grid. A 200-column line could be compressed to ~100 braille characters (2:1 ratio).

**Flow:**
1. Render ANSI text to a monochrome bitmap (character present = dot on)
2. Map each 2×4 pixel block to a braille character
3. Display braille characters in the panel

**Pros:** Works in ALL terminals, no special protocol needed
**Cons:** Very low resolution, text unreadable, only shows structure/shape

### 3. tmux Pane Resize + Capture (Re-render)

Temporarily resize the source pane to match panel width, let the application re-render, capture, resize back.

**Flow:**
1. `tmux resize-pane -t <target> -x <panel_width>`
2. Wait ~100ms for application to re-render
3. `tmux capture-pane -e -p -t <target>`
4. `tmux resize-pane -t <target> -x <original_width>`

**Pros:** Application renders content correctly at the new width
**Cons:** Visually disruptive (user sees pane flash), timing-dependent, may cause application state changes

### 4. Hidden tmux Session Mirror

Create a hidden tmux session with a pane at the panel width, pipe the source pane's PTY output to it.

**Pros:** Non-disruptive, correct rendering
**Cons:** Very complex, resource-intensive (extra process per monitored pane)

## Recommendation

**Approach 1 (Terminal Image Protocols)** is the most viable for v2.0:
- Covers the major modern terminals (Ghostty, WezTerm, iTerm2, Kitty)
- True proportional scaling with full color
- The rendering pipeline (ANSI → bitmap → scale → encode) is well-understood
- Libraries exist: `textimg`, `ansi-to-svg`, `node-canvas`

**Detection strategy:** Check `$TERM_PROGRAM` or `$TERM` for protocol support. Fall back to truncation when no image protocol is available.

**MVP implementation:**
1. Detect terminal image protocol support
2. Use `textimg` or similar to render captured ANSI to PNG
3. Scale PNG to panel width
4. Output using detected protocol (Sixel / Kitty / iTerm2)
5. Refresh every 1s (same as current LIVE mode)

## Current State (v1.2)

Using truncation (`wrap="truncate"` on AnsiText) with a width ratio indicator in the header: `[LIVE 200→130]`. This is the best text-mode solution and serves as the fallback when image protocols aren't available.
