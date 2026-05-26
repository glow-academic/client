// Personas — correctness suite (fast, strict, no video).
//
// Run via `bun run test:e2e` (testDir-scoped to e2e/specs). Reads like
// prose because all the Playwright lives below the facade. The persona it
// creates is auto-reaped by the `registry` fixture after the test.

import { test, expect } from "../fixtures";

test.describe("personas", () => {
  test("an instructor creates a student persona and sees it in the library", async ({
    personas,
    runId,
  }) => {
    const name = `Confused Student ${runId}`;

    await personas.open();
    await personas.create({
      name,
      description: "Asks clarifying questions; stalls when steps are skipped.",
      instructions:
        "You are a confused freshman in office hours. Ask short, uncertain questions and only progress when given specific, relevant guidance.",
      example: "Wait, sorry — could you explain that last step again? I'm a bit lost.",
    });

    // Back to the library, filtered to the new persona — the real proof
    // it persisted, not just that a toast fired.
    await personas.open();
    await personas.search(name);
    await expect(personas.card(name)).toBeVisible();
  });
});
