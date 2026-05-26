// Departments — correctness suite. Only the name is required; description, the
// active flag, and applicable settings are best-effort. A Department has no
// departments sub-select. Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("departments", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a department and sees it in the library", async ({
    departments,
    runId,
  }) => {
    const name = `Customer Success ${runId}`;

    await departments.create({
      name,
      description: "Team responsible for onboarding and account health.",
    });

    await departments.open();
    await departments.search(name);
    await expect(departments.card(name)).toBeVisible();
  });
});
