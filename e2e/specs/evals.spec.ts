// Evals — correctness suite. Required: name and at least one model rubric
// (which requires selecting a model first). Description, departments, and flags
// are best-effort. Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("evals", () => {
  test.describe.configure({ mode: "serial" });

  // The Models step is draft-save-heavy (model pick reveals the rubric grid),
  // so give it headroom past the 120s default.
  test.beforeEach(() => test.setTimeout(180_000));

  test("an instructor creates an eval and sees it in the library", async ({
    evals,
    runId,
  }) => {
    const name = `Tutor Quality Eval ${runId}`;

    await evals.create({
      name,
      description: "Scores tutoring responses against the quality rubric.",
    });

    await evals.open();
    await evals.search(name);
    await expect(evals.card(name)).toBeVisible();
  });
});
