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

describe("DetailPanel — compact view", () => {
  it("shows empty state when session is null", () => {
    const { lastFrame } = render(<DetailPanel session={null} />);
    expect(lastFrame()).toContain("No agent sessions detected");
  });

  it("shows metadata header with target and version", () => {
    const session = makeSession({ target: "arcforge:1.1", command: "2.1.87" });
    const { lastFrame } = render(<DetailPanel session={session} />);
    const frame = lastFrame()!;
    expect(frame).toContain("arcforge:1.1");
    expect(frame).toContain("Claude 2.1.87");
  });

  it("shows model and context % in header", () => {
    const session = makeSession({
      metadata: { lastOutput: null, model: "Opus 4.6", contextPct: 27 },
    });
    const { lastFrame } = render(<DetailPanel session={session} />);
    const frame = lastFrame()!;
    expect(frame).toContain("Opus 4.6");
    expect(frame).toContain("27% ctx");
    expect(frame).toContain("\u00B7");
  });

  it("shows conversation flow from JSONL", () => {
    const session = makeSession();
    const conversation = makeConversation([
      ["fix the auth bug", "I'll update the middleware now."],
    ]);
    const { lastFrame } = render(
      <DetailPanel session={session} conversation={conversation} />,
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
      <DetailPanel session={session} conversation={[]} />,
    );
    expect(lastFrame()).toContain("No conversation data");
  });

  it("truncates long conversation text", () => {
    const session = makeSession();
    const conversation = makeConversation([
      ["short", "A".repeat(100)],
    ]);
    const { lastFrame } = render(
      <DetailPanel session={session} conversation={conversation} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("...");
    expect(frame).not.toContain("A".repeat(100));
  });
});

describe("DetailPanel — expanded view", () => {
  it("renders scrollback content when expanded", () => {
    const session = makeSession({ sessionName: "arcforge" });
    const content = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        expanded={true}
        scrollbackContent={content}
        scrollOffset={0}
        visibleLines={5}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("arcforge — Full Transcript");
    expect(frame).toContain("Line 1");
    expect(frame).toContain("Line 5");
    expect(frame).not.toContain("Line 6");
  });

  it("respects scrollOffset", () => {
    const session = makeSession();
    const content = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        expanded={true}
        scrollbackContent={content}
        scrollOffset={10}
        visibleLines={5}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Line 11");
    expect(frame).toContain("Line 15");
    expect(frame).not.toContain("Line 1 ");
  });

  it("shows navigation hints", () => {
    const session = makeSession();
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        expanded={true}
        scrollbackContent="hello\nworld"
        scrollOffset={0}
      />,
    );
    expect(lastFrame()).toContain("Esc close");
  });

  it("clamps scrollOffset to valid range", () => {
    const session = makeSession();
    const content = "line1\nline2\nline3";
    const { lastFrame } = render(
      <DetailPanel
        session={session}
        expanded={true}
        scrollbackContent={content}
        scrollOffset={999}
        visibleLines={20}
      />,
    );
    // Should not crash, should show available lines
    const frame = lastFrame()!;
    expect(frame).toContain("line");
  });
});
