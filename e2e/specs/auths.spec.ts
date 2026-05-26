// Auths — correctness suite. Only the name is required; description,
// departments, the active flag, protocols, slugs, and auth items are
// best-effort. The auth library now has a (server-side) free-text search box,
// so the flow searches like every other domain. Auto-reaped by the registry.

import { test, expect } from "../fixtures";

test.describe("auths", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates an auth and sees it in the library", async ({
    auths,
    runId,
  }) => {
    const name = `Production API Key ${runId}`;

    await auths.create({
      name,
      description: "Credentials for the production inference gateway.",
    });

    await auths.open();
    await auths.search(name);
    await expect(auths.card(name)).toBeVisible();
  });
});
