import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: rubrics search", () => {
  test("search the rubrics library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "rubric");
  });
});
