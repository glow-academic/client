import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3000";
const isDemo = process.env["PLAYWRIGHT_DEMO"] === "1";
// Per-project storageState is set below. We deliberately don't set a
// top-level fallback because the setup project must start with NO
// state (clean context) so its forge-session POST runs fresh.
const storageState = process.env["PLAYWRIGHT_STORAGE_STATE"] || undefined;

const use = {
  baseURL,
  ...(storageState ? { storageState } : {}),
  trace: "retain-on-failure" as const,
  screenshot: "only-on-failure" as const,
  video: isDemo ? ("on" as const) : ("retain-on-failure" as const),
};

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
  timeout: isDemo ? 120_000 : 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: !isDemo,
  retries: 0,
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
        storageState: "e2e/.auth/superadmin.json",
      },
      dependencies: ["setup"],
    },
  ],
  ...webServer,
});
