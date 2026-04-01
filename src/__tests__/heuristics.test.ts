import { describe, it, expect } from "vitest";
import { classifyStatus } from "../heuristics.js";

describe("classifyStatus", () => {
  // === needs_attention (highest priority) ===
  it("returns 'needs_attention' for [Y/n] prompt", () => {
    expect(classifyStatus("Do you want to proceed? [Y/n]")).toBe("needs_attention");
  });

  it("returns 'needs_attention' for proceed? prompt", () => {
    expect(classifyStatus("Apply these changes? proceed?")).toBe("needs_attention");
  });

  it("returns 'needs_attention' case-insensitive", () => {
    expect(classifyStatus("Shall we continue? Proceed?")).toBe("needs_attention");
  });

  // === active: esc to interrupt (most reliable) ===
  it("returns 'active' for 'esc to interrupt'", () => {
    const content = "● Thinking… (esc to interrupt)\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for 'esc to cancel'", () => {
    expect(classifyStatus("Processing... (esc to cancel)")).toBe("active");
  });

  it("returns 'active' for 'esc to stop'", () => {
    expect(classifyStatus("Running tool (esc to stop)")).toBe("active");
  });

  // === active: progress words in bottom region ===
  it("returns 'active' for Whisking in bottom region", () => {
    const content = "Some old output\n".repeat(20) + "● Whisking…\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for thinking in bottom region", () => {
    const content = "Some old output\n".repeat(20) + "thinking with high effort\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for building indicator", () => {
    const content = "old stuff\n".repeat(20) + "Building project...\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for running indicator", () => {
    const content = "old stuff\n".repeat(20) + "Running tests...\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for crunching indicator", () => {
    const content = "old stuff\n".repeat(20) + "● Crunching…\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("does NOT match progress words in conversation area (above bottom 15)", () => {
    // "thinking" appears at line 5, but bottom 15 lines have only INSERT
    const conversationLines = Array(5).fill("some output")
      .concat(["I was thinking about the approach"])
      .concat(Array(20).fill("more output"));
    const content = conversationLines.join("\n") + "\n-- INSERT --";
    expect(classifyStatus(content)).toBe("idle");
  });

  // === idle: INSERT with no active signals ===
  it("returns 'idle' for INSERT with no active signals", () => {
    const content = [
      "✓ Bash ×17 | ✓ Read ×15",
      "✓ Explore: Find all version references (2m)",
      "-- INSERT --",
    ].join("\n");
    expect(classifyStatus(content)).toBe("idle");
  });

  it("returns 'idle' for plain INSERT", () => {
    expect(classifyStatus("Some output\n-- INSERT --")).toBe("idle");
  });

  // === unknown ===
  it("returns 'unknown' for unrecognized content", () => {
    expect(classifyStatus("Just some random text")).toBe("unknown");
  });

  it("returns 'unknown' for empty content", () => {
    expect(classifyStatus("")).toBe("unknown");
  });

  // === priority ordering ===
  it("prioritizes needs_attention over esc-to-interrupt", () => {
    const content = "(esc to interrupt) [Y/n]";
    expect(classifyStatus(content)).toBe("needs_attention");
  });

  it("prioritizes esc-to-interrupt over progress words", () => {
    const content = "thinking...\n(esc to interrupt)\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  it("prioritizes active over idle", () => {
    const content = "● Whisking…\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });

  // === realistic pane content ===
  it("classifies realistic idle pane correctly", () => {
    const content = [
      "⏺ Bash(git commit ...)",
      "  ⎿  [main 686a8cf] docs: bump version",
      "  ⎿  Stop says: Session paused.",
      "✻ Crunched for 34s",
      "───────────────────────────────",
      "❯ ",
      "───────────────────────────────",
      "   Opus 4.6 (1M context)",
      "  ✓ Edit ×25 | ✓ Bash ×17",
      "  -- INSERT --",
    ].join("\n");
    // "Crunched" is past tense but it's a progress word — however it's outside bottom 15
    // The bottom region has only completed tools + INSERT → idle
    expect(classifyStatus(content)).toBe("idle");
  });

  it("classifies realistic active pane correctly", () => {
    const content = [
      "Some conversation output",
      "───────────────────────────────",
      "❯ ",
      "───────────────────────────────",
      "   Opus 4.6 (1M context)",
      "● Thinking… (2m 15s · esc to interrupt)",
      "  -- INSERT --",
    ].join("\n");
    expect(classifyStatus(content)).toBe("active");
  });
});
