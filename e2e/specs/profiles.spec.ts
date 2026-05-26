// Profiles — correctness suite. Name is the only required field; the primary
// email (committed + draft-resolved) and roles are additional sections.

import { test, expect } from "../fixtures";

test.describe("profiles", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a profile and sees it in the library", async ({
    profiles,
    runId,
  }) => {
    const name = `Jordan Lee ${runId}`;

    await profiles.create({ name });

    await profiles.open();
    await profiles.search(name);
    await expect(profiles.card(name)).toBeVisible();
  });
});
