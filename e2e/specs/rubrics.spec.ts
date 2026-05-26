// Rubrics — correctness suite. Required: name and at least one department.
// Description, the active flag, pass points, and standard groups are
// best-effort; the Standards grid editor is left untouched (optional at
// submit). Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("rubrics", () => {
  test.describe.configure({ mode: "serial" });

  // Draft-save-heavy (departments, pass points, standard groups, each settling)
  // — give it headroom past the 120s default.
  test.beforeEach(() => test.setTimeout(180_000));

  test("an instructor creates a rubric and sees it in the library", async ({
    rubrics,
    runId,
  }) => {
    const name = `Sales Call Rubric ${runId}`;

    await rubrics.create({
      name,
      description: "Scores how a rep handles a discovery call.",
      passPoints: "12",
    });

    await rubrics.open();
    await rubrics.search(name);
    await expect(rubrics.card(name)).toBeVisible();
  });
});
