import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";

test.describe("demo: profiles overview", () => {
  test("browse the profiles library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "profile");
  });
});
