// Per-test profile override — via the real /profile/emulate flow (no static
// bypass). Default: every spec runs as the CLI's adopted identity (storage
// state from setup/auth.setup.ts). To act as another profile, call
// `authAs(context, profileId)` — it asks the API to emulate that profile on
// the current session; the same session keeps working and the API resolves
// the emulated profile on subsequent requests. Call `authAs(context)` with no
// id to drop the emulation and return to the CLI identity.
//
// Example:
//   test("regular GTA view", async ({ context, page }) => {
//     await authAs(context, "<gta-profile-uuid>")
//     await page.goto("/practice")
//     ...
//   })

import { expect, type BrowserContext } from "@playwright/test"

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000"

function recordToken(): string {
  const token = process.env["GLOW_RECORD_TOKEN"]
  if (!token) {
    throw new Error("GLOW_RECORD_TOKEN env var is required for authAs()")
  }
  return token
}

export async function authAs(context: BrowserContext, profileId?: string): Promise<void> {
  const headers: Record<string, string> = { Authorization: `Bearer ${recordToken()}` }
  // Emulation grant is keyed to the session the token resolves to — the same
  // session the browser's BFF calls use — so the grant applies to the page.
  const path = profileId ? "/profile/emulate" : "/profile/unemulate"
  const data = profileId ? { target_profile_id: profileId } : {}
  const res = await context.request.post(`${API_BASE}${path}`, { headers, data })
  expect(res.ok(), `${path} failed: ${res.status()} ${await res.text()}`).toBeTruthy()
}
