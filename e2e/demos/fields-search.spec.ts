import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: fields search", () => {
  test("search the fields library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "field");
  });
});
