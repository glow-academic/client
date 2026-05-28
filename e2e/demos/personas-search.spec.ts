import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: personas search", () => {
  test("search the personas library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "persona");
  });
});
