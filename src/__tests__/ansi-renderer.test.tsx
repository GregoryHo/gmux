import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { AnsiText } from "../ansi-renderer.js";

describe("AnsiText", () => {
  it("renders plain text without crash", () => {
    const { lastFrame } = render(<AnsiText text="Hello, world!" />);
    expect(lastFrame()).toContain("Hello, world!");
  });

  it("handles empty string gracefully", () => {
    const { lastFrame } = render(<AnsiText text="" />);
    // Should not throw; frame should be defined
    expect(lastFrame()).toBeDefined();
  });

  it("renders ANSI color sequences as colored text (not raw codes)", () => {
    const red = "\x1b[31mRed text\x1b[0m";
    const { lastFrame } = render(<AnsiText text={red} />);
    const frame = lastFrame()!;
    // The visible text should appear
    expect(frame).toContain("Red text");
    // Raw escape sequence characters should not appear
    expect(frame).not.toContain("\x1b[31m");
    expect(frame).not.toContain("\x1b[0m");
  });

  it("renders bold sequences without showing raw codes", () => {
    const bold = "\x1b[1mBold text\x1b[0m";
    const { lastFrame } = render(<AnsiText text={bold} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Bold text");
    expect(frame).not.toContain("\x1b[1m");
  });

  it("renders dim sequences without showing raw codes", () => {
    const dim = "\x1b[2mDim text\x1b[0m";
    const { lastFrame } = render(<AnsiText text={dim} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Dim text");
    expect(frame).not.toContain("\x1b[2m");
  });

  it("renders multi-line text correctly", () => {
    const multiline = "Line one\nLine two\nLine three";
    const { lastFrame } = render(<AnsiText text={multiline} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Line one");
    expect(frame).toContain("Line two");
    expect(frame).toContain("Line three");
  });

  it("renders multi-line ANSI text with colors across lines", () => {
    const text = "\x1b[32mGreen line\x1b[0m\nPlain line";
    const { lastFrame } = render(<AnsiText text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Green line");
    expect(frame).toContain("Plain line");
    expect(frame).not.toContain("\x1b[32m");
  });

  it("renders combined color and bold sequences", () => {
    const text = "\x1b[1;32mBold green\x1b[0m";
    const { lastFrame } = render(<AnsiText text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Bold green");
    expect(frame).not.toContain("\x1b[1;32m");
  });

  it("renders 256-color sequences without showing raw codes", () => {
    // \x1b[38;5;42m = 256-color index 42 (green)
    const text = "\x1b[38;5;42m256 green\x1b[0m";
    const { lastFrame } = render(<AnsiText text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain("256 green");
    expect(frame).not.toContain("\x1b[38;5;42m");
  });

  it("renders RGB color sequences without showing raw codes", () => {
    // \x1b[38;2;100;200;50m = RGB(100, 200, 50)
    const text = "\x1b[38;2;100;200;50mRGB text\x1b[0m";
    const { lastFrame } = render(<AnsiText text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain("RGB text");
    expect(frame).not.toContain("\x1b[38;2;");
  });
});
