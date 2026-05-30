// One-time Playwright setup: adopt a NextAuth session from the CLI's real
// token (GLOW_RECORD_TOKEN, injected by `glow record` from your `glow login`
// session) via /api/session/adopt, then save the cookie state to disk.
// Downstream specs load it automatically (playwright.config.ts) so every spec
// starts authenticated as the CLI's logged-in identity. No static bypass.
//
// To act as a different profile in a spec, use `authAs(context, profileId)`
// from `e2e/helpers/auth.ts` — it emulates via the real /profile/emulate flow.

import { test as setup, expect } from "@playwright/test"
import { join } from "node:path"

const AUTH_FILE = join(process.cwd(), "e2e/.auth/superadmin.json")

setup("adopt session from CLI token", async ({ context }) => {
  const token = process.env["GLOW_RECORD_TOKEN"]
  if (!token) {
    throw new Error(
      "GLOW_RECORD_TOKEN env var is required. `glow record` injects it from " +
      "your `glow login` session; for a manual run, export it yourself.",
    )
  }
  // Use context.request (not the top-level `request` fixture) so the
  // Set-Cookie response lands in this BrowserContext's cookie jar,
  // where storageState() can capture it.
  const res = await context.request.post("/api/session/adopt", {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok(), `session adopt failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  await context.storageState({ path: AUTH_FILE })
})
