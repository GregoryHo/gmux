import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { SessionList, statusColor } from "../components/session-list.js";
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
      <SessionList sessions={[]} selectedTarget={null} />,
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
      <SessionList sessions={sessions} selectedTarget="app:0.0" />,
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

  it("shows selection indicator on selected row (fr-ux-001-ac1)", () => {
    const sessions = [
      makeSession({ target: "a:0.0", sessionName: "first" }),
      makeSession({ target: "b:0.0", sessionName: "second" }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="b:0.0" />,
    );
    const frame = lastFrame()!;
    const lines = frame.split("\n");

    // The second row should have the ▸ indicator
    const firstLine = lines.find((l) => l.includes("first"));
    const secondLine = lines.find((l) => l.includes("second"));
    expect(firstLine).not.toContain("▸");
    expect(secondLine).toContain("▸");
  });

  it("shows ▸ on matching target regardless of list position (fr-ux-001-ac1)", () => {
    const sessions = [
      makeSession({ target: "arcforge:1.1", sessionName: "arcforge" }),
      makeSession({ target: "workspace:1.1", sessionName: "workspace" }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="arcforge:1.1" />,
    );
    const frame = lastFrame()!;
    const lines = frame.split("\n");

    const arcforgeLine = lines.find((l) => l.includes("arcforge"));
    const workspaceLine = lines.find((l) => l.includes("workspace"));
    expect(arcforgeLine).toContain("▸");
    expect(workspaceLine).not.toContain("▸");
  });

  it("shows session name in bold and command dimmed", () => {
    const sessions = [
      makeSession({
        sessionName: "arcforge",
        command: "2.1.87",
      }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="test:0.0" />,
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
      <SessionList sessions={sessions} selectedTarget="a:0.0" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("active");
    expect(frame).toContain("idle");
  });

  it("shows no indicator when selectedTarget is null", () => {
    const sessions = [
      makeSession({ target: "a:0.0", sessionName: "first" }),
    ];

    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget={null} />,
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain("▸");
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

describe("SessionList with maxHeight", () => {
  it("limits visible rows when sessions exceed maxHeight", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ target: `s${i}:1.0`, sessionName: `session${i}` }),
    );
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="s0:1.0" maxHeight={5} />,
    );
    const frame = lastFrame() ?? "";
    // Should NOT show all 10 session names
    const matchCount = sessions.filter((s) => frame.includes(s.sessionName)).length;
    expect(matchCount).toBeLessThanOrEqual(5);
  });

  it("shows scroll indicators when overflowing", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ target: `s${i}:1.0`, sessionName: `session${i}` }),
    );
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="s3:1.0" maxHeight={5} />,
    );
    const frame = lastFrame() ?? "";
    // When selected is in the middle, both indicators may appear
    expect(frame).toMatch(/▲|▼/);
  });
});

describe("SessionList search filtering (now done outside component)", () => {
  it("renders only pre-filtered sessions passed in (fr-ux-001-ac2 related)", () => {
    // Filtering is now done in app.tsx — SessionList receives already-filtered sessions
    const sessions = [
      makeSession({ target: "a:1.0", sessionName: "arcforge" }),
    ];
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedTarget="a:1.0" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("arcforge");
  });

  it("shows empty state when passed empty filtered list", () => {
    const { lastFrame } = render(
      <SessionList sessions={[]} selectedTarget={null} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("No agent sessions detected");
  });
});

describe("statusColor", () => {
  it("returns green for active status", () => {
    expect(statusColor("active")).toEqual({ color: "green" });
  });

  it("returns dimColor for idle status", () => {
    expect(statusColor("idle")).toEqual({ dimColor: true });
  });

  it("returns yellow for needs_attention status", () => {
    expect(statusColor("needs_attention")).toEqual({ color: "yellow" });
  });

  it("returns dim red for unknown status", () => {
    expect(statusColor("unknown")).toEqual({ color: "red", dimColor: true });
  });
});

describe("SessionList status dot symbols", () => {
  it("renders ● dot for active status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "active" })]} selectedTarget="test:0.0" />,
    );
    expect(lastFrame()).toContain("●");
  });

  it("renders ○ dot for idle status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "idle" })]} selectedTarget="test:0.0" />,
    );
    expect(lastFrame()).toContain("○");
  });

  it("renders ⚡ dot for needs_attention status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "needs_attention" })]} selectedTarget="test:0.0" />,
    );
    expect(lastFrame()).toContain("⚡");
  });

  it("renders ? dot for unknown status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "unknown" })]} selectedTarget="test:0.0" />,
    );
    expect(lastFrame()).toContain("?");
  });
});
