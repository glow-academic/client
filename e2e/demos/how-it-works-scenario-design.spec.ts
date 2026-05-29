import { test } from "../fixtures";
import { detailDemo } from "../helpers/crud-demos";
test.describe("demo: how-it-works scenario design", () => {
  test("tour a scenario's problem statement and objectives", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await detailDemo({ page, demo, registry, request, runId }, "scenario", "how-it-works-scenario-design",
      [/problem statement|describe the scenario/i, /objective|question/i, /document|persona|context/i]);
  });
});
