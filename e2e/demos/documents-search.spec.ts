import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: documents search", () => {
  test("search the documents library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "document");
  });
});
