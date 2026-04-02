import { Box, Text, useInput } from "ink";

export interface SearchInputProps {
  query: string;
  onChange: (query: string) => void;
  onCancel: () => void;
  isActive?: boolean;
}

export function SearchInput({ query, onChange, onCancel, isActive = true }: SearchInputProps) {
  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.return) return;
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

  return (
    <Box paddingX={1} gap={1}>
      <Text color="cyan">/</Text>
      <Text>{query}</Text>
      <Text dimColor>_</Text>
    </Box>
  );
}
