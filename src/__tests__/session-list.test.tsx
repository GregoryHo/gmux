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

describe("SessionList with maxHeight", () => {
  it("limits visible rows when sessions exceed maxHeight", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ target: `s${i}:1.0`, sessionName: `session${i}` }),
    );
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} maxHeight={5} />,
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
      <SessionList sessions={sessions} selectedIndex={3} maxHeight={5} />,
    );
    const frame = lastFrame() ?? "";
    // When selected is in the middle, both indicators may appear
    expect(frame).toMatch(/▲|▼/);
  });
});

describe("SessionList with searchQuery", () => {
  it("filters sessions by name", () => {
    const sessions = [
      makeSession({ target: "a:1.0", sessionName: "arcforge" }),
      makeSession({ target: "w:1.0", sessionName: "workspace" }),
      makeSession({ target: "s:1.0", sessionName: "settings" }),
    ];
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} searchQuery="arc" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("arcforge");
    expect(frame).not.toContain("workspace");
    expect(frame).not.toContain("settings");
  });

  it("shows no matching message when search has no results", () => {
    const sessions = [
      makeSession({ target: "a:1.0", sessionName: "arcforge" }),
    ];
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} searchQuery="zzz" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("No matching sessions");
  });

  it("is case-insensitive", () => {
    const sessions = [
      makeSession({ target: "a:1.0", sessionName: "ArcForge" }),
    ];
    const { lastFrame } = render(
      <SessionList sessions={sessions} selectedIndex={0} searchQuery="arcforge" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("ArcForge");
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
      <SessionList sessions={[makeSession({ status: "active" })]} selectedIndex={0} />,
    );
    expect(lastFrame()).toContain("●");
  });

  it("renders ○ dot for idle status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "idle" })]} selectedIndex={0} />,
    );
    expect(lastFrame()).toContain("○");
  });

  it("renders ⚡ dot for needs_attention status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "needs_attention" })]} selectedIndex={0} />,
    );
    expect(lastFrame()).toContain("⚡");
  });

  it("renders ? dot for unknown status", () => {
    const { lastFrame } = render(
      <SessionList sessions={[makeSession({ status: "unknown" })]} selectedIndex={0} />,
    );
    expect(lastFrame()).toContain("?");
  });
});
