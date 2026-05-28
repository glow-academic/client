import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: tools search", () => {
  test("search the tools library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "tool");
  });
});
