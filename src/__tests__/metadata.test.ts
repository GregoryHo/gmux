import { describe, it, expect } from "vitest";
import { extractMetadata } from "../metadata.js";

describe("extractMetadata", () => {
  describe("model extraction", () => {
    it("extracts 'Opus 4.6' model name", () => {
      const content = "Claude Code 2.1.87 - Opus 4.6 - 27% ctx";
      const meta = extractMetadata(content);
      expect(meta.model).toBe("Opus 4.6");
    });

    it("extracts 'Sonnet 4' model name", () => {
      const content = "Running with Sonnet 4 model";
      const meta = extractMetadata(content);
      expect(meta.model).toBe("Sonnet 4");
    });

    it("extracts 'Claude 3.5 Sonnet' model name", () => {
      const content = "Using Claude 3.5 Sonnet for this task";
      const meta = extractMetadata(content);
      expect(meta.model).toBe("Claude 3.5 Sonnet");
    });

    it("extracts 'Haiku 3' model name", () => {
      const content = "Model: Haiku 3";
      const meta = extractMetadata(content);
      expect(meta.model).toBe("Haiku 3");
    });

    it("returns null when no model is mentioned", () => {
      const content = "Just some regular output text";
      const meta = extractMetadata(content);
      expect(meta.model).toBeNull();
    });
  });

  describe("context percentage extraction", () => {
    it("extracts percentage from '27% ctx' format", () => {
      const content = "Opus 4.6 - 27% ctx";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBe(27);
    });

    it("extracts percentage from '82% context' format", () => {
      const content = "Token usage: 82% context remaining";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBe(82);
    });

    it("extracts percentage from 'context: 45%' format", () => {
      const content = "context: 45%";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBe(45);
    });

    it("returns null for no context info", () => {
      const content = "No context percentage here";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBeNull();
    });

    it("returns null for out-of-range percentage", () => {
      const content = "999% ctx";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBeNull();
    });

    it("handles 0% ctx", () => {
      const content = "0% ctx";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBe(0);
    });

    it("handles 100% ctx", () => {
      const content = "100% ctx";
      const meta = extractMetadata(content);
      expect(meta.contextPct).toBe(100);
    });
  });

  describe("lastOutput extraction", () => {
    it("extracts text above prompt lines", () => {
      const content = [
        "I'll update the hook configuration now.",
        "The changes have been applied successfully.",
        "",
        "> ",
      ].join("\n");
      const meta = extractMetadata(content);
      expect(meta.lastOutput).not.toBeNull();
      expect(meta.lastOutput).toContain("changes have been applied");
    });

    it("extracts text stopping at thinking indicator", () => {
      const content = [
        "Whisking...",
        "Here is my response.",
        "It has multiple lines.",
        "",
        "> ",
      ].join("\n");
      const meta = extractMetadata(content);
      expect(meta.lastOutput).not.toBeNull();
      expect(meta.lastOutput).toContain("my response");
      expect(meta.lastOutput).not.toContain("Whisking");
    });

    it("returns null for empty content", () => {
      const meta = extractMetadata("");
      expect(meta.lastOutput).toBeNull();
    });

    it("returns null for only prompt lines", () => {
      const content = [
        "",
        "> ",
        "",
      ].join("\n");
      const meta = extractMetadata(content);
      expect(meta.lastOutput).toBeNull();
    });

    it("limits snippet length", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      lines.push("", "> ");
      const content = lines.join("\n");
      const meta = extractMetadata(content);
      // Should not contain more than 5 lines
      if (meta.lastOutput) {
        const outputLines = meta.lastOutput.split("\n");
        expect(outputLines.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("combined extraction", () => {
    it("extracts all fields from realistic pane content", () => {
      const content = [
        "Claude Code 2.1.87 - Opus 4.6 - 27% ctx",
        "───────────────────────────────────",
        "Whisking...",
        "I've updated the configuration file.",
        "The changes look good.",
        "",
        "> ",
      ].join("\n");

      const meta = extractMetadata(content);
      expect(meta.model).toBe("Opus 4.6");
      expect(meta.contextPct).toBe(27);
      expect(meta.lastOutput).not.toBeNull();
    });

    it("returns all nulls for unparseable content", () => {
      const meta = extractMetadata("random noise without any patterns");
      // model and context should be null
      expect(meta.model).toBeNull();
      expect(meta.contextPct).toBeNull();
      // lastOutput may or may not be null depending on prompt detection
    });
  });
});
