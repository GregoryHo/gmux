import { Box, Text, useInput } from "ink";

export interface SearchInputProps {
  query: string;
  onChange: (query: string) => void;
  onCancel: () => void;
  onAccept?: () => void;
  isActive?: boolean;
  matchCount?: number;
  totalCount?: number;
}

export function SearchInput({
  query,
  onChange,
  onCancel,
  onAccept,
  isActive = true,
  matchCount,
  totalCount,
}: SearchInputProps) {
  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.return) {
        onAccept?.();
        return;
      }
      if (key.backspace || key.delete) {
        onChange(query.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      if (key.tab) return;

      if (input) {
        onChange(query + input);
      }
    },
    { isActive },
  );

  const showMatchCount = matchCount !== undefined && totalCount !== undefined;

  return (
    <Box paddingX={1} gap={1}>
      <Text backgroundColor="cyan" color="white" bold>{" / "}</Text>
      <Text>{query}</Text>
      <Text dimColor>_</Text>
      {showMatchCount ? <Text dimColor>{matchCount}/{totalCount}</Text> : null}
    </Box>
  );
}
