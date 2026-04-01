import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../app.js";
import { DEFAULT_CONFIG } from "../config.js";
import { createServer } from "node:net";

function makeProps() {
  return {
    config: { ...DEFAULT_CONFIG },
    server: createServer(),
  };
}

describe("App", () => {
  it("renders gmux header", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).toContain("gmux");
  });

  it("shows empty state when no sessions", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).toContain("No agent sessions detected");
  });

  it("shows session count in header", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).toContain("0 sessions");
  });

  it("shows command input prompt", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).toContain("❯");
  });
});
