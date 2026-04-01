import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { SessionCreator } from "../components/session-creator.js";

/** Wait for React effects and ink rendering to settle. */
async function waitForRender(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

describe("SessionCreator", () => {
  it("renders step 1 with directory input", () => {
    const { lastFrame } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={vi.fn()} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("New Session (1/3)");
    expect(frame).toContain("Directory:");
    expect(frame).toContain("~");
  });

  it("transitions to step 2 on Enter and auto-suggests session name", async () => {
    const { lastFrame, stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitForRender();
    // Type a directory path (appends to pre-filled ~)
    stdin.write("/projects/myapp");
    await waitForRender();
    // Press Enter to advance to step 2
    stdin.write("\r");
    await waitForRender();

    const frame = lastFrame();
    expect(frame).toContain("New Session (2/3)");
    expect(frame).toContain("Session name:");
    // Should auto-suggest "myapp" from the directory basename
    expect(frame).toContain("myapp");
  });

  it("transitions to step 3 on second Enter", async () => {
    const { lastFrame, stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitForRender();
    // Step 1: Enter directory
    stdin.write("/projects/myapp");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    // Step 2: Accept default name, press Enter
    stdin.write("\r");
    await waitForRender();

    const frame = lastFrame();
    expect(frame).toContain("New Session (3/3)");
    expect(frame).toContain("Command:");
    expect(frame).toContain("claude -c");
  });

  it("calls onCreate with all fields on final Enter", async () => {
    const onCreate = vi.fn();
    const { stdin } = render(
      <SessionCreator onCreate={onCreate} onCancel={vi.fn()} />,
    );

    await waitForRender();
    // Step 1: directory
    stdin.write("/projects/myapp");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    // Step 2: accept auto-suggested name
    stdin.write("\r");
    await waitForRender();

    // Step 3: accept default command
    stdin.write("\r");
    await waitForRender();

    expect(onCreate).toHaveBeenCalledWith(
      "~/projects/myapp",
      "myapp",
      "claude -c",
    );
  });

  it("allows editing the session name", async () => {
    const onCreate = vi.fn();
    const { lastFrame, stdin } = render(
      <SessionCreator onCreate={onCreate} onCancel={vi.fn()} />,
    );

    await waitForRender();
    // Step 1: directory
    stdin.write("/projects/myapp");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    // Step 2: clear auto-suggested name "myapp" and type custom one
    // Delete 5 chars
    for (let i = 0; i < 5; i++) {
      stdin.write("\x7f");
      await waitForRender();
    }
    stdin.write("custom");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    const frame = lastFrame();
    expect(frame).toContain("New Session (3/3)");

    // Step 3: accept default command
    stdin.write("\r");
    await waitForRender();

    expect(onCreate).toHaveBeenCalledWith(
      "~/projects/myapp",
      "custom",
      "claude -c",
    );
  });

  it("calls onCancel when Escape is pressed at step 1", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={onCancel} />,
    );

    await waitForRender();
    stdin.write("\x1b");
    await waitForRender();
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed at step 2", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={onCancel} />,
    );

    await waitForRender();
    // Advance to step 2
    stdin.write("\r");
    await waitForRender();
    stdin.write("\x1b");
    await waitForRender();
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed at step 3", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={onCancel} />,
    );

    await waitForRender();
    // Advance to step 2
    stdin.write("\r");
    await waitForRender();
    // Need a non-empty name — default from "~" basename is "~"
    stdin.write("test");
    await waitForRender();
    // Advance to step 3
    stdin.write("\r");
    await waitForRender();
    stdin.write("\x1b");
    await waitForRender();
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not advance from step 1 if directory is empty", async () => {
    const { lastFrame, stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitForRender();
    // Clear the pre-filled "~"
    stdin.write("\x7f");
    await waitForRender();
    // Try to advance
    stdin.write("\r");
    await waitForRender();

    const frame = lastFrame();
    // Should still be on step 1
    expect(frame).toContain("New Session (1/3)");
  });

  it("does not advance from step 2 if name is empty", async () => {
    const { lastFrame, stdin } = render(
      <SessionCreator onCreate={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitForRender();
    // Go to step 2
    stdin.write("/projects/ab");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    // Clear the auto-suggested name "ab"
    stdin.write("\x7f");
    await waitForRender();
    stdin.write("\x7f");
    await waitForRender();

    // Try to advance with empty name
    stdin.write("\r");
    await waitForRender();

    const frame = lastFrame();
    // Should still be on step 2
    expect(frame).toContain("New Session (2/3)");
  });
});
