import { test } from "../fixtures";
import { editDemo } from "../helpers/crud-demos";

test.describe("demo: scenarios edit", () => {
  test("edit a scenario", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await editDemo({ page, demo, registry, request, runId }, "scenario");
  });
});
