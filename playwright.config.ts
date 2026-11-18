import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, type Project } from "@playwright/test";

/**
 * Test accounts for solidcommunity.net and ESS, from .env.local (never
 * committed). Each value is everything after the first "=", without
 * surrounding quotes: unlike Node's .env parser, a "#" inside a password
 * isn't taken as the start of a comment. Variables already set win.
 */
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 1 || line.trimStart().startsWith("#")) continue;
    const name = line.slice(0, at).trim().replace(/^export\s+/, "");
    const value = line.slice(at + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    process.env[name] ??= value;
  }
} catch {
  // No .env.local: only the local server runs.
}

// The local throwaway server's account gets a new random password each run
// (inherited by the server started below and by the tests).
process.env.E2E_LOCAL_PASSWORD ??= randomBytes(18).toString("base64url");

// Failure reports must not capture login pages, where typed credentials can
// show up as page text: no page snapshots, screenshots, traces or videos.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const env = process.env;
const projects: Project[] = [{ name: "local-css" }];
if (env.CSS_TEST_USERNAME && env.CSS_TEST_PASSWORD) projects.push({ name: "solidcommunity" });
if (env.ESS_TEST_USERNAME && env.ESS_TEST_PASSWORD) projects.push({ name: "ess" });

/**
 * End-to-end smoke tests (npm run test:e2e). Each server's run signs in,
 * browses, uploads, previews, shares and cleans up a throwaway folder.
 * They talk to real servers, so they run one at a time and slowly.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  projects,
  use: {
    baseURL: "http://localhost:3001",
    // The installed Chrome by default; E2E_BROWSER_CHANNEL="" uses Playwright's own Chromium.
    channel: env.E2E_BROWSER_CHANNEL ?? "chrome",
    // Each step fails well within the test's budget, leaving time to clean up.
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  webServer: [
    {
      command: "node e2e/start-css.mjs",
      url: "http://localhost:3000/.well-known/openid-configuration",
      reuseExistingServer: false,
      timeout: 120_000,
      // Playwright would otherwise SIGKILL it, and the script couldn't remove
      // its temporary folder.
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
    {
      // A production build, so the security headers apply as they do when deployed.
      command: "npm run build && npx next start --port 3001",
      url: "http://localhost:3001/login",
      // Always this checkout's own build, never a stale or development server.
      reuseExistingServer: false,
      timeout: 600_000,
    },
  ],
});
