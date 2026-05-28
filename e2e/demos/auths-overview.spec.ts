import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";

test.describe("demo: auths overview", () => {
  test("browse the auths library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "auth");
  });
});
