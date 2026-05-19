// One-time Playwright setup: forges a NextAuth session via the
// /api/e2e/login bypass route + saves the cookie state to disk.
// Downstream tests load the storage state automatically (configured
// in playwright.config.ts) so every spec starts authenticated as the
// bootstrap superadmin.
//
// To impersonate a different profile in a specific test, use
// `authAs(context, profileId)` from `e2e/helpers/auth.ts` — that
// overrides the saved state per-test.

import { test as setup, expect } from "@playwright/test"
import { join } from "node:path"

const AUTH_FILE = join(process.cwd(), "e2e/.auth/superadmin.json")

setup("forge superadmin session", async ({ context }) => {
  const token = process.env["E2E_BYPASS_TOKEN"]
  if (!token) {
    throw new Error(
      "E2E_BYPASS_TOKEN env var is required. Set it in .env.local " +
      "(must match the api repo's E2E_BYPASS_TOKEN).",
    )
  }
  // Use context.request (not the top-level `request` fixture) so the
  // Set-Cookie response lands in this BrowserContext's cookie jar,
  // where storageState() can capture it.
  const res = await context.request.post("/api/e2e/login", {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok(), `bypass login failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  await context.storageState({ path: AUTH_FILE })
})
