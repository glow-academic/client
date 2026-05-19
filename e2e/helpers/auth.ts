// Per-test profile override for the E2E auth bypass.
//
// Default: every test starts authenticated as the bootstrap superadmin
// (storage state from setup/auth.setup.ts). For tests that need to
// exercise a different role, call `authAs(context, profileId)` before
// navigating — it replaces the session cookie with one tied to the
// given profile.
//
// Example:
//   test("regular GTA view", async ({ context, page }) => {
//     await authAs(context, "<gta-profile-uuid>")
//     await page.goto("/practice")
//     ...
//   })

import { expect, type BrowserContext } from "@playwright/test"

export async function authAs(context: BrowserContext, profileId?: string): Promise<void> {
  const token = process.env["E2E_BYPASS_TOKEN"]
  if (!token) {
    throw new Error("E2E_BYPASS_TOKEN env var is required for authAs()")
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (profileId) headers["X-E2E-Profile-Id"] = profileId
  const res = await context.request.post("/api/e2e/login", { headers })
  expect(res.ok(), `bypass login failed: ${res.status()} ${await res.text()}`).toBeTruthy()
}
