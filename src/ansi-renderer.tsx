import React from "react";
import { Text } from "ink";
import { parseAnsiSequences } from "ansi-sequence-parser";
import type { ParseToken } from "ansi-sequence-parser";

export interface AnsiTextProps {
  text: string;
}

/**
 * Resolve the Ink-compatible color string from a ParseToken's foreground field.
 * Named colors from ansi-sequence-parser match Ink/Chalk color names directly.
 * Table (256-color) and RGB colors are rendered as hex strings via createColorPalette.
 */
function resolveColor(token: ParseToken): string | undefined {
  const fg = token.foreground;
  if (!fg) return undefined;
  if (fg.type === "named") return fg.name;
  if (fg.type === "rgb") {
    const [r, g, b] = fg.rgb;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  // table (256-color): skip for now — complex to map without a palette
  return undefined;
}

/**
 * Render a single ParseToken as an Ink Text element with appropriate style props.
 */
function TokenSpan({ token }: { token: ParseToken }) {
  const color = resolveColor(token);
  const bold = token.decorations.has("bold");
  const dim = token.decorations.has("dim");
  const italic = token.decorations.has("italic");
  const underline = token.decorations.has("underline");
  const strikethrough = token.decorations.has("strikethrough");

  return (
    <Text
      color={color}
      bold={bold || undefined}
      dimColor={dim || undefined}
      italic={italic || undefined}
      underline={underline || undefined}
      strikethrough={strikethrough || undefined}
    >
      {token.value}
    </Text>
  );
}

/**
 * AnsiText parses ANSI escape sequences and renders them as styled Ink Text components.
 * Plain text, colors, bold, dim, and other SGR styles are supported.
 * Non-SGR sequences (cursor movement, etc.) are silently ignored.
 */
export function AnsiText({ text }: AnsiTextProps) {
  if (text === "") {
    return <Text>{""}</Text>;
  }

  const tokens = parseAnsiSequences(text);

  return (
    <>
      {tokens.map((token, i) => (
        <TokenSpan key={i} token={token} />
      ))}
    </>
  );
}
