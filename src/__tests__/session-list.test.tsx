import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { SessionList } from "../components/session-list.js";
import { truncateCwd, formatDuration } from "../components/session-list.js";
import type { AgentSession } from "../types.js";

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    target: "test:0.0",
    sessionName: "test",
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

describe("SessionList", () => {
  it("renders empty state when no sessions", () => {
    const { lastFrame } = render(
      <SessionList sessions={[]} selectedIndex={0} />,
    );
    expect(lastFrame()).toContain("No agent sessions detected");
  });

  it("renders session rows with status dots", () => {
    const sessions = [
      makeSession({
        target: "app:0.0",
        sessionName: "app",
        status: "active",
      }),
      makeSession({
        target: "work:1.0",
        sessionName: "work",
        status: "idle",
      }),
      makeSession({
        target: "dev:2.0",
        sessionName: "dev",
        status: "needs_attention",
      }),
      makeSession({
        target: "misc:3.0",
        sessionName: "misc",
        status: "unknown",
      }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain("●");
    expect(frame).toContain("○");
    expect(frame).toContain("⚡");
    expect(frame).toContain("?");
    expect(frame).toContain("app");
    expect(frame).toContain("work");
    expect(frame).toContain("dev");
    expect(frame).toContain("misc");
  });

  it("shows selection indicator on selected row", () => {
    const sessions = [
      makeSession({ target: "a:0.0", sessionName: "first" }),
      makeSession({ target: "b:0.0", sessionName: "second" }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={1} />,
    );
    const frame = lastFrame()!;
    const lines = frame.split("\n");

    // The second row should have the ▸ indicator
    const firstLine = lines.find((l) => l.includes("first"));
    const secondLine = lines.find((l) => l.includes("second"));
    expect(firstLine).not.toContain("▸");
    expect(secondLine).toContain("▸");
  });

  it("shows session name in bold and command dimmed", () => {
    const sessions = [
      makeSession({
        sessionName: "arcforge",
        command: "2.1.87",
      }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("arcforge");
    expect(frame).toContain("2.1.87");
  });

  it("shows status labels", () => {
    const sessions = [
      makeSession({ target: "a:0.0", status: "active" }),
      makeSession({ target: "b:0.0", status: "idle" }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("active");
    expect(frame).toContain("idle");
  });
});

describe("truncateCwd", () => {
  it("replaces home directory with ~", () => {
    const home = process.env["HOME"] ?? "/Users/test";
    expect(truncateCwd(`${home}/projects`)).toBe("~/projects");
  });

  it("abbreviates intermediate directories", () => {
    const home = process.env["HOME"] ?? "/Users/test";
    const result = truncateCwd(`${home}/GitHub/AI/myproject`);
    expect(result).toBe("~/G/A/myproject");
  });

  it("handles short paths without abbreviation", () => {
    expect(truncateCwd("/tmp")).toBe("/tmp");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  it("formats minutes", () => {
    expect(formatDuration(150)).toBe("2m");
  });

  it("formats hours", () => {
    expect(formatDuration(7200)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(5400)).toBe("1h30m");
  });
});
