import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, DEFAULT_CONFIG } from "../config.js";

const TEST_DIR = join(tmpdir(), "gmux-test-config");
const TEST_CONFIG = join(TEST_DIR, "config.json");

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

describe("loadConfig", () => {
  it("returns defaults when config file does not exist", async () => {
    const config = await loadConfig(join(TEST_DIR, "nonexistent.json"));
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("merges partial config with defaults", async () => {
    await writeFile(
      TEST_CONFIG,
      JSON.stringify({ sound: true, pollInterval: 5000 }),
    );

    const config = await loadConfig(TEST_CONFIG);

    expect(config.sound).toBe(true);
    expect(config.pollInterval).toBe(5000);
    expect(config.notificationCooldown).toBe(DEFAULT_CONFIG.notificationCooldown);
  });

  it("returns defaults on invalid JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await writeFile(TEST_CONFIG, "not valid json {{{");

    const config = await loadConfig(TEST_CONFIG);

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid JSON"),
    );
    warn.mockRestore();
  });

  it("returns defaults when config is an array", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await writeFile(TEST_CONFIG, JSON.stringify([1, 2, 3]));

    const config = await loadConfig(TEST_CONFIG);

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("not an object"),
    );
    warn.mockRestore();
  });

  it("returns full config when all fields provided", async () => {
    const full = { pollInterval: 1000, notificationCooldown: 60000, sound: true };
    await writeFile(TEST_CONFIG, JSON.stringify(full));

    const config = await loadConfig(TEST_CONFIG);
    expect(config).toEqual(full);
  });
});
