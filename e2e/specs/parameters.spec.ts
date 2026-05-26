// Parameters — correctness suite. A parameter groups fields. Name is the only
// required field; departments, the active flag, and included fields are
// best-effort sections. Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("parameters", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a parameter and sees it in the library", async ({
    parameters,
    runId,
  }) => {
    const name = `Student Age ${runId}`;

    await parameters.create({
      name,
      description: "The learner's age band, used to tune scenario difficulty.",
    });

    await parameters.open();
    await parameters.search(name);
    await expect(parameters.card(name)).toBeVisible();
  });
});
