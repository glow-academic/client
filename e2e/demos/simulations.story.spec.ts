// Simulation — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: simulations", () => {
  test("instructor builds a simulation", async ({
    simulations,
    runId,
    page,
  }) => {
    const name = `Onboarding Sim ${runId}`;

    await simulations.create({
      name,
      description: "A multi-scenario onboarding simulation for new hires.",
    });

    await simulations.open();
    await simulations.search(name);
    await simulations.library.expectVisible(name);

    await saveDemoVideo(page, "simulations-create-story");
  });
});
