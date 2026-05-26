// Providers — correctness suite. Required: name and value. Description,
// departments, the active flag, and the endpoint URL are best-effort sections.
// Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("providers", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a provider and sees it in the library", async ({
    providers,
    runId,
  }) => {
    const name = `Acme AI ${runId}`;

    await providers.create({
      name,
      value: `acme-${runId}`,
      description: "Hosted inference provider for tutoring models.",
      endpoint: "https://api.acme.example/v1",
    });

    await providers.open();
    await providers.search(name);
    await expect(providers.card(name)).toBeVisible();
  });
});
