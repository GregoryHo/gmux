import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import { CommandInput } from "../components/command-input.js";

// Mock the commander module
vi.mock("../commander.js", () => ({
  sendKeys: vi.fn().mockResolvedValue(undefined),
}));

import { sendKeys } from "../commander.js";

const mockedSendKeys = vi.mocked(sendKeys);

/** Wait for React effects and ink rendering to settle. */
async function waitForRender(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

describe("CommandInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompt symbol", () => {
    const { lastFrame } = render(
      <CommandInput selectedTarget="test:0.0" />,
    );
    expect(lastFrame()).toContain("❯");
  });

  it("renders cursor placeholder", () => {
    const { lastFrame } = render(
      <CommandInput selectedTarget="test:0.0" />,
    );
    expect(lastFrame()).toContain("_");
  });

  it("captures typed text", async () => {
    const { lastFrame, stdin } = render(
      <CommandInput selectedTarget="test:0.0" />,
    );
    await waitForRender();
    stdin.write("h");
    await waitForRender();
    expect(lastFrame()).toContain("h");
  });

  it("calls sendKeys on Enter with selected target", async () => {
    const onSend = vi.fn();
    const { stdin } = render(
      <CommandInput selectedTarget="test:0.0" onSend={onSend} />,
    );

    await waitForRender();
    stdin.write("t");
    await waitForRender();
    stdin.write("\r"); // Enter key
    await waitForRender();

    await vi.waitFor(() => {
      expect(mockedSendKeys).toHaveBeenCalledWith("test:0.0", "t");
    });
  });

  it("does not call sendKeys when no target selected", async () => {
    const { stdin } = render(
      <CommandInput selectedTarget={null} />,
    );

    await waitForRender();
    stdin.write("h");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    expect(mockedSendKeys).not.toHaveBeenCalled();
  });

  it("does not send empty text", async () => {
    const { stdin } = render(
      <CommandInput selectedTarget="test:0.0" />,
    );

    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    expect(mockedSendKeys).not.toHaveBeenCalled();
  });

  it("calls onSend callback after successful send", async () => {
    const onSend = vi.fn();
    const { stdin } = render(
      <CommandInput selectedTarget="test:0.0" onSend={onSend} />,
    );

    await waitForRender();
    stdin.write("x");
    await waitForRender();
    stdin.write("\r");
    await waitForRender();

    await vi.waitFor(() => {
      expect(onSend).toHaveBeenCalledWith("x");
    });
  });
});
