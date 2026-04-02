import { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface SessionCreatorProps {
  /** Called when the wizard completes all 3 steps. */
  onCreate: (dir: string, name: string, cmd: string) => void;
  /** Called when the user presses Escape at any step. */
  onCancel: () => void;
}

type Step = 1 | 2 | 3;

/**
 * SessionCreator — a 3-step wizard for creating a new tmux session.
 *
 * Step 1: Enter project directory path (pre-filled with ~)
 * Step 2: Enter session name (auto-suggested from directory basename)
 * Step 3: Enter launch command (pre-filled with "claude -c")
 */
export function SessionCreator({ onCreate, onCancel }: SessionCreatorProps) {
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState("~");
  const [name, setName] = useState("");
  const [cmd, setCmd] = useState("claude -c");

  useInput((input, key) => {
    // Escape cancels at any step
    if (key.escape) {
      onCancel();
      return;
    }

    // Enter advances to next step or completes
    if (key.return) {
      if (step === 1) {
        if (dir.trim() === "") return;
        // Auto-suggest session name from directory basename
        const trimmedDir = dir.trim().replace(/\/+$/, "");
        const parts = trimmedDir.split("/");
        const basename = parts[parts.length - 1] || "session";
        setName(basename);
        setStep(2);
        return;
      }
      if (step === 2) {
        if (name.trim() === "") return;
        setStep(3);
        return;
      }
      if (step === 3) {
        if (cmd.trim() === "") return;
        onCreate(dir.trim(), name.trim(), cmd.trim());
        return;
      }
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      if (step === 1) setDir((prev) => prev.slice(0, -1));
      if (step === 2) setName((prev) => prev.slice(0, -1));
      if (step === 3) setCmd((prev) => prev.slice(0, -1));
      return;
    }

    // Ignore control/meta/special keys
    if (key.ctrl || key.meta) return;
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
    if (key.tab) return;

    // Append printable characters
    if (input) {
      if (step === 1) setDir((prev) => prev + input);
      if (step === 2) setName((prev) => prev + input);
      if (step === 3) setCmd((prev) => prev + input);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      paddingY={0}
    >
      <Text bold>New Session ({step}/3)</Text>

      {step === 1 ? (
        <Box gap={1}>
          <Text>Directory:</Text>
          <Text color="cyan">{dir}</Text>
          <Text dimColor>_</Text>
        </Box>
      ) : (
        <Box gap={1}>
          <Text dimColor>Directory:</Text>
          <Text dimColor>{dir}</Text>
        </Box>
      )}

      {step >= 2 ? (
        step === 2 ? (
          <Box gap={1}>
            <Text>Session name:</Text>
            <Text color="cyan">{name}</Text>
            <Text dimColor>_</Text>
          </Box>
        ) : (
          <Box gap={1}>
            <Text dimColor>Session name:</Text>
            <Text dimColor>{name}</Text>
          </Box>
        )
      ) : null}

      {step >= 3 ? (
        <Box gap={1}>
          <Text>Command:</Text>
          <Text color="cyan">{cmd}</Text>
          <Text dimColor>_</Text>
        </Box>
      ) : null}

      <Text dimColor>Enter to continue, Esc to cancel</Text>
    </Box>
  );
}
