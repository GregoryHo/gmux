import React from "react";
import { Text } from "ink";
import { parseAnsiSequences } from "ansi-sequence-parser";
import type { ParseToken } from "ansi-sequence-parser";

export interface AnsiTextProps {
  text: string;
}

// Standard 256-color palette: 0-7 standard, 8-15 bright, 16-231 6x6x6 cube, 232-255 grayscale
const PALETTE_256: string[] = (() => {
  const p: string[] = [];
  const std = ["#000000","#800000","#008000","#808000","#000080","#800080","#008080","#c0c0c0"];
  const hi  = ["#808080","#ff0000","#00ff00","#ffff00","#0000ff","#ff00ff","#00ffff","#ffffff"];
  p.push(...std, ...hi);
  for (let r = 0; r < 6; r++)
    for (let g = 0; g < 6; g++)
      for (let b = 0; b < 6; b++)
        p.push("#" + [r, g, b].map(c => (c ? c * 40 + 55 : 0).toString(16).padStart(2, "0")).join(""));
  for (let i = 0; i < 24; i++) {
    const v = (i * 10 + 8).toString(16).padStart(2, "0");
    p.push(`#${v}${v}${v}`);
  }
  return p;
})();

function resolveColor(token: ParseToken): string | undefined {
  const fg = token.foreground;
  if (!fg) return undefined;
  if (fg.type === "named") return fg.name;
  if (fg.type === "table") return PALETTE_256[fg.index];
  if (fg.type === "rgb") {
    const [r, g, b] = fg.rgb;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return undefined;
}

function resolveBgColor(token: ParseToken): string | undefined {
  const bg = token.background;
  if (!bg) return undefined;
  if (bg.type === "named") return bg.name;
  if (bg.type === "table") return PALETTE_256[bg.index];
  if (bg.type === "rgb") {
    const [r, g, b] = bg.rgb;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return undefined;
}

/**
 * Render a single ParseToken as an Ink Text element with appropriate style props.
 */
function TokenSpan({ token }: { token: ParseToken }) {
  const color = resolveColor(token);
  const bgColor = resolveBgColor(token);
  const bold = token.decorations.has("bold");
  const dim = token.decorations.has("dim");
  const italic = token.decorations.has("italic");
  const underline = token.decorations.has("underline");
  const strikethrough = token.decorations.has("strikethrough");

  return (
    <Text
      color={color}
      backgroundColor={bgColor}
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
