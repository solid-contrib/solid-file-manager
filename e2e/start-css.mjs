// Starts a throwaway Community Solid Server (ACP, as in .cssconfig.json) for the
// end-to-end tests, with one fictional account, in a fresh temporary folder.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOCAL_ACCOUNT } from "./accounts.mjs";

const root = mkdtempSync(join(tmpdir(), "sfm-e2e-css-"));
const seed = join(root, "seed.json");
writeFileSync(seed, JSON.stringify([{ email: LOCAL_ACCOUNT.email, password: LOCAL_ACCOUNT.password, pods: [{ name: LOCAL_ACCOUNT.pod }] }]));

// The server's own entry point, run directly (not through npx), so this is the
// only process to stop.
const server = createRequire(import.meta.url).resolve("@solid/community-server/bin/server.js");
const css = spawn(
  process.execPath,
  [server, "--port", "3000", "--loggingLevel", "warn", "--config", ".cssconfig.json", "--rootFilePath", join(root, "data"), "--seedConfig", seed],
  {
    stdio: "inherit",
    // The server reads CSS_* variables as its own options, and .env.local's
    // CSS_TEST_* account isn't for this server, so none are passed on.
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("CSS_"))),
  },
);

// Stop the server, and only once it has exited remove its files.
const stop = () => css.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
css.on("exit", (code) => {
  rmSync(root, { recursive: true, force: true });
  process.exit(code ?? 0);
});
