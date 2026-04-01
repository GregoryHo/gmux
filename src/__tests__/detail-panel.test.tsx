import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { DetailPanel } from "../components/detail-panel.js";
import type { AgentSession } from "../types.js";

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    target: "app:0.0",
    sessionName: "app",
    command: "2.1.87",
    cwd: "/Users/user/projects/myapp",
    tty: "/dev/ttys001",
    pid: 12345,
    status: "active",
    metadata: {
      lastOutput: null,
      model: null,
      contextPct: null,
    },
    paneContent: "",
    ...overrides,
  };
}

describe("DetailPanel", () => {
  it("shows empty state when session is null", () => {
    const { lastFrame } = render(<DetailPanel session={null} />);
    expect(lastFrame()).toContain("No agent sessions detected");
  });

  it("shows target and claude version", () => {
    const session = makeSession({
      target: "arcforge:1.1",
      command: "2.1.87",
    });

    const { lastFrame } = render(<DetailPanel session={session} />);
    const frame = lastFrame()!;
    expect(frame).toContain("arcforge:1.1");
    expect(frame).toContain("Claude 2.1.87");
  });

  it("shows model when available", () => {
    const session = makeSession({
      metadata: {
        lastOutput: null,
        model: "Opus 4.6",
        contextPct: null,
      },
    });

    const { lastFrame } = render(<DetailPanel session={session} />);
    expect(lastFrame()).toContain("Opus 4.6");
  });

  it("shows context percentage when available", () => {
    const session = makeSession({
      metadata: {
        lastOutput: null,
        model: null,
        contextPct: 27,
      },
    });

    const { lastFrame } = render(<DetailPanel session={session} />);
    expect(lastFrame()).toContain("27% ctx");
  });

  it("shows last output when available", () => {
    const session = makeSession({
      metadata: {
        lastOutput: "I'll update the hook config...",
        model: null,
        contextPct: null,
      },
    });

    const { lastFrame } = render(<DetailPanel session={session} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Last:");
    expect(frame).toContain("I'll update the hook config...");
  });

  it("truncates long last output", () => {
    const longOutput = "A".repeat(100);
    const session = makeSession({
      metadata: {
        lastOutput: longOutput,
        model: null,
        contextPct: null,
      },
    });

    const { lastFrame } = render(<DetailPanel session={session} />);
    const frame = lastFrame()!;
    expect(frame).toContain("...");
    // Should be truncated to about 80 chars
    expect(frame).not.toContain("A".repeat(100));
  });

  it("shows all info combined with dot separators", () => {
    const session = makeSession({
      target: "work:1.0",
      command: "2.1.87",
      metadata: {
        lastOutput: "Done!",
        model: "Sonnet 4",
        contextPct: 45,
      },
    });

    const { lastFrame } = render(<DetailPanel session={session} />);
    const frame = lastFrame()!;
    expect(frame).toContain("work:1.0");
    expect(frame).toContain("Claude 2.1.87");
    expect(frame).toContain("Sonnet 4");
    expect(frame).toContain("45% ctx");
    // Middle dot separator
    expect(frame).toContain("\u00B7");
  });
});
