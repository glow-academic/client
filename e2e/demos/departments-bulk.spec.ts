import { test } from "../fixtures";
import { bulkDeleteDemo } from "../helpers/crud-demos";

test.describe("demo: departments bulk", () => {
  test("bulk-delete departments", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await bulkDeleteDemo({ page, demo, registry, request, runId }, "department");
  });
});
