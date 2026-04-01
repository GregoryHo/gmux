import { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { sendKeys } from "../commander.js";

export interface CommandInputProps {
  /** The tmux target of the selected session, or null if no session selected. */
  selectedTarget: string | null;
  /** Callback invoked after a successful send. */
  onSend?: (text: string) => void;
  /** Whether the input is active (receives keystrokes). Defaults to true. */
  isActive?: boolean;
}

/**
 * CommandInput — text input at the bottom of the screen.
 * On Enter: sends typed text to the selected tmux pane via send-keys.
 * Shows a brief "sent ✓" indicator for 2 seconds after a successful send.
 */
export function CommandInput({
  selectedTarget,
  onSend,
  isActive = true,
}: CommandInputProps) {
  const [text, setText] = useState("");
  const [sentIndicator, setSentIndicator] = useState(false);

  // Clear sent indicator after 2 seconds
  useEffect(() => {
    if (!sentIndicator) return;
    const timer = setTimeout(() => setSentIndicator(false), 2000);
    return () => clearTimeout(timer);
  }, [sentIndicator]);

  const handleSubmit = useCallback(async () => {
    if (!selectedTarget || text.trim() === "") return;

    try {
      await sendKeys(selectedTarget, text);
      setSentIndicator(true);
      onSend?.(text);
      setText("");
    } catch {
      // Command failed — silently ignore (pane may have disappeared)
    }
  }, [selectedTarget, text, onSend]);

  useInput(
    (input, key) => {
      if (key.return) {
        void handleSubmit();
        return;
      }

      if (key.backspace || key.delete) {
        setText((prev) => prev.slice(0, -1));
        return;
      }

      // Ignore control characters and special keys
      if (key.ctrl || key.meta || key.escape) return;
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow)
        return;
      if (key.tab) return;

      // Append printable characters
      if (input) {
        setText((prev) => prev + input);
      }
    },
    { isActive },
  );

  return (
    <Box paddingX={1} gap={1}>
      <Text>❯</Text>
      <Text>{text}</Text>
      <Text dimColor>_</Text>
      {sentIndicator ? <Text color="green">sent ✓</Text> : null}
    </Box>
  );
}
