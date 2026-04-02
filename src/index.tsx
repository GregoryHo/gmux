#!/usr/bin/env node
import { render } from "ink";
import { resolve, dirname } from "node:path";
import { App } from "./app.js";
import { startup, cleanup, registerSignalHandlers } from "./lifecycle.js";
import { loadConfig } from "./config.js";
import { enterAlternateScreen, exitAlternateScreen } from "./screen.js";
import { detectHooks } from "./hooks-detector.js";

async function main() {
  if (process.argv.includes("--setup-hooks")) {
    const { setupHooks } = await import("./setup-hooks.js");
    const hooksDir = resolve(dirname(new URL(import.meta.url).pathname), "..", "hooks");
    try {
      await setupHooks(hooksDir);
      console.log("gmux: hooks configured in ~/.claude/settings.json");
      process.exit(0);
    } catch (err) {
      console.error(`gmux: failed to setup hooks: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }

  const config = await loadConfig();
  const hooksConfigured = await detectHooks();

  let result;
  try {
    result = await startup();
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }

  enterAlternateScreen();
  registerSignalHandlers(result.server ?? undefined);

  const { waitUntilExit } = render(<App config={config} server={result.server} hooksConfigured={hooksConfigured} />);

  await waitUntilExit();
  exitAlternateScreen();
  await cleanup(result.server ?? undefined);
}

main();
