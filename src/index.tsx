#!/usr/bin/env node
import { render } from "ink";
import { App } from "./app.js";
import { startup, cleanup, registerSignalHandlers } from "./lifecycle.js";
import { loadConfig } from "./config.js";
import { enterAlternateScreen, exitAlternateScreen } from "./screen.js";

async function main() {
  const config = await loadConfig();

  let result;
  try {
    result = await startup();
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }

  enterAlternateScreen();
  registerSignalHandlers(result.server ?? undefined);

  const { waitUntilExit } = render(<App config={config} server={result.server} />);

  await waitUntilExit();
  exitAlternateScreen();
  await cleanup(result.server ?? undefined);
}

main();
