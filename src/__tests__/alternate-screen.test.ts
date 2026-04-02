import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("alternate screen", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("enterAlternateScreen writes the correct escape", async () => {
    const { enterAlternateScreen } = await import("../screen.js");
    enterAlternateScreen();
    expect(writeSpy).toHaveBeenCalledWith("\x1b[?1049h");
  });

  it("exitAlternateScreen writes the correct escape", async () => {
    const { exitAlternateScreen } = await import("../screen.js");
    exitAlternateScreen();
    expect(writeSpy).toHaveBeenCalledWith("\x1b[?1049l");
  });
});
