import { Box, Text, useInput } from "ink";
import type { TmuxClient } from "../commander.js";

export interface ClientPickerProps {
  clients: TmuxClient[];
  onSelect: (client: TmuxClient) => void;
  onCancel: () => void;
}

/**
 * ClientPicker — overlay for choosing a tmux client when multiple are available.
 * Displays a numbered list; press 1-9 to select, Escape to cancel.
 */
export function ClientPicker({ clients, onSelect, onCancel }: ClientPickerProps) {
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    const num = parseInt(input, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= clients.length) {
      onSelect(clients[num - 1]);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      paddingY={0}
    >
      <Text bold>Select tmux client:</Text>
      {clients.map((client, i) => (
        <Box key={client.tty} gap={1}>
          <Text color="cyan">{i + 1}.</Text>
          <Text>{client.name}</Text>
          <Text dimColor>({client.tty})</Text>
        </Box>
      ))}
      <Text dimColor>Press 1-{clients.length} to select, Esc to cancel</Text>
    </Box>
  );
}
