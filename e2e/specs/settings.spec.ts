// Settings — correctness suite. Required: name and at least one color.
// Description, departments, the active flag, and the picker sections (logins,
// systems, mcp, providers, auths) are best-effort. Auto-reaped by the registry.

import { test, expect } from "../fixtures";

test.describe("settings", () => {
  test.describe.configure({ mode: "serial" });

  // Many steps, each settling — give it headroom past the 120s default.
  test.beforeEach(() => test.setTimeout(180_000));

  test("an instructor creates a setting and sees it in the library", async ({
    settings,
    runId,
  }) => {
    const name = `University Settings ${runId}`;

    await settings.create({
      name,
      description: "Tenant-wide configuration for the university workspace.",
    });

    await settings.open();
    await settings.search(name);
    await expect(settings.card(name)).toBeVisible();
  });
});
