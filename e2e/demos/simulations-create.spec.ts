import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: simulations create", () => {
  test("instructor builds a simulation", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "simulation", {
      name: `Onboarding Simulation ${runId}`,
      description: "A multi-scenario onboarding simulation for new hires.",
    });
  });
});
