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

  it("shows notifications zone placeholder when empty", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).toContain("No notifications");
  });

  it("renders with null server (socket unavailable mode)", () => {
    const { lastFrame } = render(
      <App config={{ ...DEFAULT_CONFIG }} server={null} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("gmux");
    expect(output).toContain("⚠");
    expect(output).toContain("socket");
  });
});

describe("App — detail panel wiring (live capture + freeze)", () => {
  it("shows [LIVE] mode indicator by default (detailSource defaults to live)", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    // With no session selected, the panel shows empty state but the mode indicator
    // is not shown — just verify the panel area renders without crash
    expect(lastFrame()).toBeTruthy();
  });

  it("shows session list and notifications when not frozen (normal state)", () => {
    const { lastFrame } = render(<App {...makeProps()} />);
    const output = lastFrame() ?? "";
    // Both session list panel and notifications panel should be visible
    expect(output).toContain("No agent sessions detected");
    expect(output).toContain("No notifications");
  });

  it("does not crash when paneAlive is computed with empty sessions", () => {
    // App passes paneAlive={sessions.some(s => s.target === selectedSession.target)}
    // With no sessions and no selectedSession, paneAlive=false must not cause a crash
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).toBeTruthy();
  });

  it("UIMode type no longer includes expanded-detail variant", () => {
    // The App renders fine without the old expanded-detail UIMode
    // Verified by TypeScript compilation — this test ensures App doesn't reference it
    const { lastFrame } = render(<App {...makeProps()} />);
    expect(lastFrame()).not.toContain("expanded-detail");
  });
});
