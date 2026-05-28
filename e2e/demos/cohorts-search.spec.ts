import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: cohorts search", () => {
  test("search the cohorts library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "cohort");
  });
});
