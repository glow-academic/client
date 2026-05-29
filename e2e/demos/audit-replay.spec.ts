// TODO: placeholder demo — needs a supervised/headed pass.
// generation-events (normal gen) works via Enter-to-send. audit-replay is the
// SAFE-MODE path: cookie `glow.gp.safeMode=1` enables it, the run soft-stages
// tool calls, and an "Accept" button takes the audit (soft→accept) path. The
// genDemo helper has all of this (safeMode opt → cookie + wait-for-Accept), but
// the live safe-mode run repeatedly exceeds 180s here (slow/degraded backend on
// that path), so it needs a headed look to confirm timing + the Accept flow.
import { test } from "@playwright/test";

test.describe("demo: audit-replay", () => {
  test.fixme("needs supervised pass: live safe-mode gen + Accept exceeds budget", async () => {});
});
