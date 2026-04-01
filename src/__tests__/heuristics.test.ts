import { describe, it, expect } from "vitest";
import { classifyStatus } from "../heuristics.js";

describe("classifyStatus", () => {
  it("returns 'idle' for INSERT mode indicator", () => {
    const content = [
      "Some previous output here",
      "-- INSERT --",
    ].join("\n");

    expect(classifyStatus(content)).toBe("idle");
  });

  it("returns 'active' for Whisking indicator", () => {
    const content = "Whisking a response for you...";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for thinking indicator", () => {
    const content = "Claude is thinking about your request...";
    expect(classifyStatus(content)).toBe("active");
  });

  it("returns 'active' for case-insensitive thinking", () => {
    expect(classifyStatus("THINKING...")).toBe("active");
  });

  it("returns 'needs_attention' for [Y/n] prompt", () => {
    const content = "Do you want to proceed? [Y/n]";
    expect(classifyStatus(content)).toBe("needs_attention");
  });

  it("returns 'needs_attention' for proceed? prompt", () => {
    const content = "Apply these changes? proceed?";
    expect(classifyStatus(content)).toBe("needs_attention");
  });

  it("returns 'needs_attention' for case-insensitive proceed", () => {
    const content = "Shall we continue? Proceed?";
    expect(classifyStatus(content)).toBe("needs_attention");
  });

  it("returns 'unknown' for unrecognized content", () => {
    const content = "Just some random text output";
    expect(classifyStatus(content)).toBe("unknown");
  });

  it("returns 'unknown' for empty content", () => {
    expect(classifyStatus("")).toBe("unknown");
  });

  it("returns 'unknown' for whitespace-only content", () => {
    expect(classifyStatus("   \n  \n  ")).toBe("unknown");
  });

  it("prioritizes needs_attention over active", () => {
    // Content with both thinking and [Y/n]
    const content = "thinking about... [Y/n]";
    expect(classifyStatus(content)).toBe("needs_attention");
  });

  it("prioritizes needs_attention over idle", () => {
    const content = "-- INSERT -- \n proceed?";
    expect(classifyStatus(content)).toBe("needs_attention");
  });

  it("prioritizes active over idle", () => {
    // Content with both Whisking and INSERT
    const content = "Whisking\n-- INSERT --";
    expect(classifyStatus(content)).toBe("active");
  });
});
