import { describe, it, expect } from "vitest";
import { parsePaneLine, parseListPanesOutput } from "../tmux.js";

describe("parsePaneLine", () => {
  it("parses a valid agent pane line", () => {
    const line = "myproject:0.1|1.2.3|/home/user/project|/dev/ttys001|12345";
    const pane = parsePaneLine(line);

    expect(pane).toEqual({
      target: "myproject:0.1",
      sessionName: "myproject",
      command: "1.2.3",
      cwd: "/home/user/project",
      tty: "/dev/ttys001",
      pid: 12345,
    });
  });

  it("parses a version with larger numbers", () => {
    const line = "work:2.0|2.1.87|/Users/dev/workspace|/dev/ttys003|99999";
    const pane = parsePaneLine(line);

    expect(pane).not.toBeNull();
    expect(pane!.command).toBe("2.1.87");
    expect(pane!.sessionName).toBe("work");
  });

  it("returns null for non-agent pane (shell command)", () => {
    const line = "mysession:0.0|zsh|/home/user|/dev/ttys000|1234";
    expect(parsePaneLine(line)).toBeNull();
  });

  it("returns null for non-agent pane (vim)", () => {
    const line = "editing:1.0|vim|/home/user/code|/dev/ttys002|5678";
    expect(parsePaneLine(line)).toBeNull();
  });

  it("returns null for empty line", () => {
    expect(parsePaneLine("")).toBeNull();
  });

  it("returns null for whitespace-only line", () => {
    expect(parsePaneLine("   \n  ")).toBeNull();
  });

  it("returns null for malformed line (wrong number of fields)", () => {
    expect(parsePaneLine("a|b|c")).toBeNull();
    expect(parsePaneLine("a|b|c|d|e|f")).toBeNull();
  });

  it("returns null for invalid PID", () => {
    const line = "sess:0.0|1.2.3|/path|/dev/tty|notanumber";
    expect(parsePaneLine(line)).toBeNull();
  });

  it("rejects command with extra version segments", () => {
    const line = "sess:0.0|1.2.3.4|/path|/dev/tty|1000";
    expect(parsePaneLine(line)).toBeNull();
  });

  it("rejects command with non-numeric version", () => {
    const line = "sess:0.0|v1.2.3|/path|/dev/tty|1000";
    expect(parsePaneLine(line)).toBeNull();
  });
});

describe("parseListPanesOutput", () => {
  const sampleOutput = [
    "project-a:0.0|1.2.3|/home/user/project-a|/dev/ttys001|10001",
    "project-b:1.0|zsh|/home/user/project-b|/dev/ttys002|10002",
    "project-c:0.1|2.1.87|/home/user/project-c|/dev/ttys003|10003",
    "project-d:2.0|vim|/home/user/project-d|/dev/ttys004|10004",
    "",
  ].join("\n");

  it("filters only agent panes from mixed output", () => {
    const panes = parseListPanesOutput(sampleOutput, new Set());
    expect(panes).toHaveLength(2);
    expect(panes[0].sessionName).toBe("project-a");
    expect(panes[1].sessionName).toBe("project-c");
  });

  it("excludes panes matching self PIDs", () => {
    const selfPids = new Set([10001]);
    const panes = parseListPanesOutput(sampleOutput, selfPids);

    expect(panes).toHaveLength(1);
    expect(panes[0].sessionName).toBe("project-c");
  });

  it("excludes panes matching parent PID", () => {
    const selfPids = new Set([10001, 10003]);
    const panes = parseListPanesOutput(sampleOutput, selfPids);

    expect(panes).toHaveLength(0);
  });

  it("handles empty output", () => {
    expect(parseListPanesOutput("", new Set())).toEqual([]);
  });

  it("handles output with only non-agent panes", () => {
    const nonAgent = [
      "sess:0.0|zsh|/path|/dev/tty|1000",
      "sess:0.1|bash|/path|/dev/tty|1001",
    ].join("\n");

    expect(parseListPanesOutput(nonAgent, new Set())).toEqual([]);
  });

  it("handles malformed lines gracefully", () => {
    const mixed = [
      "good:0.0|1.2.3|/path|/dev/tty|5000",
      "bad line without pipes",
      "also-good:1.0|3.4.5|/other|/dev/tty2|6000",
    ].join("\n");

    const panes = parseListPanesOutput(mixed, new Set());
    expect(panes).toHaveLength(2);
  });
});
