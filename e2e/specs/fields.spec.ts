// Fields — correctness suite. A field is the atomic parameter item. Name is the
// only required field; departments, the active flag, and conditional parameters
// are best-effort sections. Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("fields", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a field and sees it in the library", async ({
    fields,
    runId,
  }) => {
    const name = `Learning Style ${runId}`;

    await fields.create({
      name,
      description: "How the learner prefers to absorb material.",
    });

    await fields.open();
    await fields.search(name);
    await expect(fields.card(name)).toBeVisible();
  });
});
