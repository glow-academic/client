// Models — correctness suite. Required to submit: name, value, and a provider.
// Departments, the active flag, and the flag-gated sections (modalities,
// temperature, pricing, reasoning, voices, qualities) are best-effort.
// Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("models", () => {
  test.describe.configure({ mode: "serial" });

  // Full-fill flips on each feature flag to reveal its section, with a settle
  // between steps — give it headroom past the 120s default.
  test.beforeEach(() => test.setTimeout(180_000));

  test("an instructor creates a model and sees it in the library", async ({
    models,
    runId,
  }) => {
    const name = `Aurora ${runId}`;

    await models.create({
      name,
      description: "A general-purpose chat model for tutoring scenarios.",
      value: `aurora-${runId}`,
    });

    await models.open();
    await models.search(name);
    await expect(models.card(name)).toBeVisible();
  });
});
