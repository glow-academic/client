import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3000";
const isDemo = process.env["PLAYWRIGHT_DEMO"] === "1";
// Per-project storageState is set below. We deliberately don't set a
// top-level fallback because the setup project must start with NO
// state (clean context) so its forge-session POST runs fresh.
const storageState = process.env["PLAYWRIGHT_STORAGE_STATE"] || undefined;

// Demos record at a crisp 1600x900 (vs Playwright's default ~800x450) so the
// polished video is sharp. Correctness runs keep the default — video there is
// only kept on failure for debugging, where size doesn't matter.
const use = {
  baseURL,
  ...(storageState ? { storageState } : {}),
  trace: "retain-on-failure" as const,
  screenshot: "only-on-failure" as const,
  video: isDemo
    ? ({ mode: "on", size: { width: 1600, height: 900 } } as const)
    : ("retain-on-failure" as const),
};

// Larger viewport for demo recordings so the captured resolution is high and
// 1:1 (no downscaling). Applied only in demo mode to leave correctness runs
// on the standard Desktop Chrome viewport.
const demoViewport = isDemo
  ? { viewport: { width: 1600, height: 900 } }
  : {};

const webServer =
  process.env["PLAYWRIGHT_NO_SERVER"] === "1"
    ? {}
    : {
        webServer: {
          command: "bun run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  // Generous timeout: the full-fill scenario submit is a heavy commit and the
  // dev DB slows it under load (≈25s in isolation, 60s+ in a suite run).
  timeout: isDemo ? 240_000 : 120_000,
  expect: { timeout: 10_000 },
  // Run serially. The full-fill flows autosave a draft on every field change
  // (~a dozen DB writes per test); running them in parallel exhausts the dev
  // Postgres connection pool ("too many clients"). Serial is reliable here —
  // raise this once the backend pool can handle concurrent heavy flows.
  fullyParallel: false,
  workers: 1,
  // One retry absorbs transient dev-DB slowness; demos never retry (recording).
  retries: isDemo ? 0 : 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use,
  projects: [
    // One-time auth setup — forges a NextAuth session via the bypass
    // route and writes the cookie state to e2e/.auth/superadmin.json.
    // Other projects depend on this so every spec starts authenticated.
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...demoViewport,
        storageState: "e2e/.auth/superadmin.json",
      },
      dependencies: ["setup"],
    },
  ],
  ...webServer,
});
