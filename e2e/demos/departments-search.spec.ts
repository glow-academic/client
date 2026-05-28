import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: departments search", () => {
  test("search the departments library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "department");
  });
});
