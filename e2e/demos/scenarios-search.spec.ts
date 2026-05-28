import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: scenarios search", () => {
  test("search the scenarios library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "scenario");
  });
});
