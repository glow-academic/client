import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: providers search", () => {
  test("search the providers library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "provider");
  });
});
