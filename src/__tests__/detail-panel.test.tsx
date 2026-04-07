import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { DetailPanel } from "../components/detail-panel.js";
import type { AgentSession } from "../types.js";
import type { ConversationEntry } from "../jsonl-reader.js";

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    target: "app:0.0",
    sessionName: "app",
    command: "2.1.87",
    cwd: "/Users/user/projects/myapp",
    tty: "/dev/ttys001",
    pid: 12345,
    status: "active",
    metadata: { lastOutput: null, model: null, contextPct: null },
    paneContent: "",
    ...overrides,
  };
}

function makeConversation(pairs: [string, string][]): ConversationEntry[] {
  return pairs.flatMap(([user, ai], i) => [
    { role: "user" as const, text: user, timestamp: `2026-04-01T10:${String(i).padStart(2, "0")}:00Z` },
    { role: "assistant" as const, text: ai, timestamp: `2026-04-01T10:${String(i).padStart(2, "0")}:05Z` },
  ]);
}

// --- fr-detail-001/fr-detail-002: New props API ---

describe("DetailPanel — new props: empty state", () => {
  it("shows empty state when session is null", () => {
    const { lastFrame } = render(
      <DetailPanel session={null} source="live" frozen={false} />,
    );
    expect(lastFrame()).toContain("No agent sessions detected");
  });
});

// --- fr-detail-005: Mode indicator ---

describe("DetailPanel — mode indicator (fr-detail-005)", () => {
  it("shows [LIVE] in LIVE following mode", () => {
    const session = makeSession({ target: "arcforge:1.1", command: "2.1.87" });
    const { lastFrame } = render(
      <DetailPanel session={session} source="live" frozen={false} liveContent="hello" />,
    );
    expect(lastFrame()).toContain("[LIVE]");
  });

  it("shows [CONV] in CONV following mode", () => {
    const session = makeSession();
    const conversation = makeConversation([["hi", "hello"]]);
    const { lastFrame } = render(
      <DetailPanel session={session} source="conv" frozen={false} conversation={conversation} />,
    );
    expect(lastFrame()).toContain("[CONV]");
  });

  it("shows [LIVE ⏸] in LIVE frozen mode", () => {
    const session = makeSession();
    const { lastFrame } = render(
      <DetailPanel session={session} source="live" frozen={true} liveContent="hello" />,
    );
    expect(lastFrame()).toContain("[LIVE ⏸]");
  });

  it("shows [CONV ⏸] in CONV frozen mode", () => {
    const session = makeSession();
    const conversation = makeConversation([["hi", "hello"]]);
    const { lastFrame } = render(
      <DetailPanel session={session} source="conv" frozen={true} conversation={conversation} />,
    );
    expect(lastFrame()).toContain("[CONV ⏸]");
  });
});

// --- Metadata header ---

describe("DetailPanel — metadata header", () => {
  it("shows target and version in header", () => {
    const session = makeSession({ target: "arcforge:1.1", command: "2.1.87" });
    const { lastFrame } = render(
      <DetailPanel session={session} source="conv" frozen={false} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("arcforge:1.1");
    expect(frame).toContain("Claude 2.1.87");
  });

  it("shows model and context % in header", () => {
    const session = makeSession({
      metadata: { lastOutput: null, model: "Opus 4.6", contextPct: 27 },
    });
    const { lastFrame } = render(
      <DetailPanel session={session} source="conv" frozen={false} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Opus 4.6");
    expect(frame).toContain("27% ctx");
    expect(frame).toContain("\u00B7");
  });
});

// --- fr-detail-002: CONV mode renders conversation ---

describe("DetailPanel — CONV mode (fr-detail-002)", () => {
  it("shows conversation flow from JSONL", () => {
    const session = makeSession();
    const conversation = makeConversation([
      ["fix the auth bug", "I'll update the middleware now."],
    ]);
    const { lastFrame } = render(
      <DetailPanel session={session} source="conv" frozen={false} conversation={conversation} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("You:");
    expect(frame).toContain("fix the auth bug");
    expect(frame).toContain("AI:");
    expect(frame).toContain("I'll update the middleware now.");
  });

  it("shows 'No conversation data' when conversation is empty", () => {
    const session = makeSession();
    const { lastFrame } = render(
      <DetailPanel session={session} source="conv" frozen={false} conversation={[]} />,
    );
    expect(lastFrame()).toContain("No conversation data");
  });

  it("limits long conversation text per entry", () => {
    const session = makeSession();
    const conversation = makeConversation([
      ["short", "A".repeat(500)],
    ]);
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="conv"
        frozen={false}
        conversation={conversation}
        visibleLines={5}
      />,
    );
    const frame = lastFrame()!;
    // Should not show the full 500 chars
    expect(frame).not.toContain("A".repeat(500));
    // Should show the message content (some of it)
    expect(frame).toContain("You:");
    expect(frame).toContain("AI:");
  });
});

// --- fr-detail-001: LIVE mode renders terminal content ---

describe("DetailPanel — LIVE mode (fr-detail-001)", () => {
  it("renders liveContent using AnsiText component (shows plain text)", () => {
    const session = makeSession();
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        frozen={false}
        liveContent={"line one\nline two\nline three"}
        visibleLines={10}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("line one");
    expect(frame).toContain("line two");
    expect(frame).toContain("line three");
  });

  it("auto-scrolls to bottom (latest lines) when not frozen", () => {
    const session = makeSession();
    const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`);
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        frozen={false}
        liveContent={lines.join("\n")}
        visibleLines={5}
      />,
    );
    const frame = lastFrame()!;
    // Should show the last lines (minus 1 for header)
    expect(frame).toContain("Line 30");
    expect(frame).toContain("Line 28");
    expect(frame).not.toContain("Line 1");
  });

  it("shows liveContent as empty space when liveContent is undefined", () => {
    const session = makeSession();
    // Should not crash when liveContent is not provided
    const { lastFrame } = render(
      <DetailPanel session={session} source="live" frozen={false} />,
    );
    // Must not throw, must render header
    expect(lastFrame()).toContain("app:0.0");
  });
});

// --- fr-detail-003: Frozen mode with scroll offset ---

describe("DetailPanel — frozen mode (fr-detail-003)", () => {
  it("respects scrollOffset from top when frozen", () => {
    const session = makeSession();
    const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`);
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        frozen={true}
        liveContent={lines.join("\n")}
        scrollOffset={5}
        visibleLines={5}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Line 6");
    expect(frame).not.toContain("Line 1 ");
    expect(frame).not.toContain("Line 30");
  });

  it("clamps scrollOffset to valid range when frozen", () => {
    const session = makeSession();
    const content = "line1\nline2\nline3";
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        frozen={true}
        liveContent={content}
        scrollOffset={999}
        visibleLines={20}
      />,
    );
    // Should not crash, should show available lines
    const frame = lastFrame()!;
    expect(frame).toContain("line");
  });
});

// --- fr-detail-004: paneAlive indicator ---

describe("DetailPanel — session ended indicator (fr-detail-004)", () => {
  it("shows 'session ended' when paneAlive is false", () => {
    const session = makeSession();
    const conversation = makeConversation([["hi", "hello"]]);
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="conv"
        frozen={false}
        conversation={conversation}
        paneAlive={false}
      />,
    );
    expect(lastFrame()).toContain("session ended");
  });

  it("does not show 'session ended' when paneAlive is true", () => {
    const session = makeSession();
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        source="live"
        frozen={false}
        liveContent="hello"
        paneAlive={true}
      />,
    );
    expect(lastFrame()).not.toContain("session ended");
  });

  it("does not show 'session ended' when paneAlive is not provided (default true)", () => {
    const session = makeSession();
    const { lastFrame } = render(
      <DetailPanel session={session} source="live" frozen={false} liveContent="hello" />,
    );
    expect(lastFrame()).not.toContain("session ended");
  });
});
