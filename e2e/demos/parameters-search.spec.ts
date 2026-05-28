import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: parameters search", () => {
  test("search the parameters library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "parameter");
  });
});
