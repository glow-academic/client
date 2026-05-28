import { test } from "../fixtures";
import { bulkDeleteDemo } from "../helpers/crud-demos";

test.describe("demo: simulations bulk", () => {
  test("bulk-delete simulations", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await bulkDeleteDemo({ page, demo, registry, request, runId }, "simulation");
  });
});
