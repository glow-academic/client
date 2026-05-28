import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: models search", () => {
  test("search the models library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "model");
  });
});
