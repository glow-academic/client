// Simulations — correctness suite. Cross-entity: requires a scenario and a
// rubric to exist (seed data provides them). Required = name + scenario +
// scenario rubric; departments/flags are optional best-effort.

import { test, expect } from "../fixtures";

test.describe("simulations", () => {
  // Draft-save-heavy like scenarios — keep serial.
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a simulation and sees it in the library", async ({
    simulations,
    runId,
  }) => {
    const name = `Onboarding Sim ${runId}`;

    await simulations.create({
      name,
      description: "A multi-scenario onboarding simulation for new hires.",
    });

    await simulations.open();
    await simulations.search(name);
    await expect(simulations.card(name)).toBeVisible();
  });
});
