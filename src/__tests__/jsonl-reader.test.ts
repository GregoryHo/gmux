import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cwdToProjectHash, readConversation } from "../jsonl-reader.js";

describe("cwdToProjectHash", () => {
  it("converts CWD to Claude project hash format", () => {
    expect(cwdToProjectHash("/Users/gregho/GitHub/AI/arcforge"))
      .toBe("-Users-gregho-GitHub-AI-arcforge");
  });

  it("handles root path", () => {
    expect(cwdToProjectHash("/")).toBe("-");
  });

  it("handles single directory", () => {
    expect(cwdToProjectHash("/tmp")).toBe("-tmp");
  });
});

describe("readConversation", () => {
  const testDir = join(tmpdir(), `gmux-jsonl-test-${process.pid}`);
  const claudeDir = join(testDir, ".claude");
  const projectDir = join(claudeDir, "projects", "-test-project");
  const cwd = "/test/project";

  beforeEach(async () => {
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns empty array when no project directory exists", async () => {
    const result = await readConversation("/nonexistent/path", 3, claudeDir);
    expect(result).toEqual([]);
  });

  it("returns empty array when no .jsonl files exist", async () => {
    const result = await readConversation(cwd, 3, claudeDir);
    expect(result).toEqual([]);
  });

  it("parses user and assistant messages from JSONL", async () => {
    const lines = [
      JSON.stringify({
        type: "user",
        userType: "external",
        message: { content: "fix the bug" },
        timestamp: "2026-04-01T10:00:00Z",
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "I'll fix it now." }] },
        timestamp: "2026-04-01T10:00:05Z",
      }),
    ];

    await writeFile(join(projectDir, "session.jsonl"), lines.join("\n") + "\n");

    const result = await readConversation(cwd, 3, claudeDir);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: "user",
      text: "fix the bug",
      timestamp: "2026-04-01T10:00:00Z",
    });
    expect(result[1]).toEqual({
      role: "assistant",
      text: "I'll fix it now.",
      timestamp: "2026-04-01T10:00:05Z",
    });
  });

  it("skips non-external user messages (tool results, subagents)", async () => {
    const lines = [
      JSON.stringify({
        type: "user", userType: "external",
        message: { content: "hello" },
        timestamp: "2026-04-01T10:00:00Z",
      }),
      JSON.stringify({
        type: "user", userType: "tool_result",
        message: { content: "tool output" },
        timestamp: "2026-04-01T10:00:01Z",
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "hi there" }] },
        timestamp: "2026-04-01T10:00:02Z",
      }),
    ];

    await writeFile(join(projectDir, "session.jsonl"), lines.join("\n") + "\n");

    const result = await readConversation(cwd, 3, claudeDir);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("skips assistant messages with only tool_use content (no text)", async () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "Read", input: {} }] },
        timestamp: "2026-04-01T10:00:00Z",
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Done reading." }] },
        timestamp: "2026-04-01T10:00:01Z",
      }),
    ];

    await writeFile(join(projectDir, "session.jsonl"), lines.join("\n") + "\n");

    const result = await readConversation(cwd, 3, claudeDir);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Done reading.");
  });

  it("picks the most recently modified .jsonl file", async () => {
    const oldFile = join(projectDir, "old-session.jsonl");
    const newFile = join(projectDir, "new-session.jsonl");

    await writeFile(oldFile, JSON.stringify({
      type: "user", userType: "external",
      message: { content: "old message" },
      timestamp: "2026-01-01T00:00:00Z",
    }) + "\n");

    await new Promise((r) => setTimeout(r, 50));

    await writeFile(newFile, JSON.stringify({
      type: "user", userType: "external",
      message: { content: "new message" },
      timestamp: "2026-04-01T00:00:00Z",
    }) + "\n");

    const result = await readConversation(cwd, 3, claudeDir);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("new message");
  });

  it("limits results to maxExchanges * 2 entries", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push(JSON.stringify({
        type: i % 2 === 0 ? "user" : "assistant",
        userType: i % 2 === 0 ? "external" : undefined,
        message: { content: i % 2 === 0 ? `question ${i}` : [{ type: "text", text: `answer ${i}` }] },
        timestamp: `2026-04-01T10:${String(i).padStart(2, "0")}:00Z`,
      }));
    }

    await writeFile(join(projectDir, "session.jsonl"), lines.join("\n") + "\n");

    const result = await readConversation(cwd, 2, claudeDir);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("handles malformed JSONL lines gracefully", async () => {
    const lines = [
      "not valid json",
      JSON.stringify({
        type: "user", userType: "external",
        message: { content: "valid message" },
        timestamp: "2026-04-01T10:00:00Z",
      }),
      "{broken json",
    ];

    await writeFile(join(projectDir, "session.jsonl"), lines.join("\n") + "\n");

    const result = await readConversation(cwd, 3, claudeDir);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("valid message");
  });
});
