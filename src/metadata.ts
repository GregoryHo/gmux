import type { PaneMetadata } from "./types.js";

/**
 * Pattern to detect model identifiers in pane content.
 * Matches common Claude model names like "Opus 4.6", "Sonnet 4", "Claude 3.5 Sonnet", etc.
 */
const MODEL_PATTERN =
  /\b(Opus|Sonnet|Haiku|Claude)\s+\d+(?:\.\d+)?(?:\s+(?:Opus|Sonnet|Haiku))?\b/i;

/**
 * Pattern to detect context window usage percentage.
 * Matches formats like "27% ctx", "45% context", "context: 82%"
 */
const CONTEXT_PCT_PATTERN = /(\d{1,3})%\s*(?:ctx|context)|context[:\s]+(\d{1,3})%/i;

/**
 * Extract a last-output snippet from pane content.
 *
 * Looks for text between a thinking/processing indicator and an input prompt.
 * The assistant's last output is typically the text after processing completes
 * and before the next input prompt appears.
 */
function extractLastOutput(paneContent: string): string | null {
  const lines = paneContent.split("\n");

  // Look for the last substantial block of text.
  // Scan backwards, skipping prompt lines and status bars.
  const promptPatterns = [
    /^[>$]\s*/, // shell/input prompts
    /^──/, // separator lines
    /^\s*$/, // blank lines
    /-- INSERT --/, // vim-style mode indicator
  ];

  // Collect the last meaningful text block by scanning from the bottom
  const outputLines: string[] = [];
  let foundContent = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    // Skip trailing prompt/blank lines until we find content
    if (!foundContent) {
      const isPromptLine = promptPatterns.some((p) => p.test(line));
      if (isPromptLine) continue;
      foundContent = true;
    }

    // Once we found content, collect lines until we hit a thinking indicator
    // or a clear section boundary
    if (/Whisking|thinking|^───|^━━/i.test(line)) {
      break;
    }

    outputLines.unshift(line);

    // Limit to a reasonable snippet
    if (outputLines.length >= 5) break;
  }

  if (outputLines.length === 0) return null;

  const snippet = outputLines.join("\n").trim();
  return snippet.length > 0 ? snippet : null;
}

/**
 * Extract model name from pane content.
 */
function extractModel(paneContent: string): string | null {
  const match = MODEL_PATTERN.exec(paneContent);
  return match ? match[0] : null;
}

/**
 * Extract context usage percentage from pane content.
 */
function extractContextPct(paneContent: string): number | null {
  const match = CONTEXT_PCT_PATTERN.exec(paneContent);
  if (!match) return null;

  const pctStr = match[1] || match[2];
  const pct = parseInt(pctStr, 10);

  if (Number.isNaN(pct) || pct < 0 || pct > 100) return null;
  return pct;
}

/**
 * Extract metadata from captured pane content.
 * Returns lastOutput, model, and contextPct -- any or all may be null
 * if the content does not contain parseable data.
 */
export function extractMetadata(paneContent: string): PaneMetadata {
  return {
    lastOutput: extractLastOutput(paneContent),
    model: extractModel(paneContent),
    contextPct: extractContextPct(paneContent),
  };
}
