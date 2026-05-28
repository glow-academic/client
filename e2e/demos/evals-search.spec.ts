import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: evals search", () => {
  test("search the evals library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "eval");
  });
});
