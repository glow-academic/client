import { test } from "../fixtures";
import { editDemo } from "../helpers/crud-demos";

test.describe("demo: simulations edit", () => {
  test("edit a simulation", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await editDemo({ page, demo, registry, request, runId }, "simulation");
  });
});
