import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";

test.describe("demo: agents overview", () => {
  test("browse the agents library", async ({ page, demo, registry, request, runId }) => {
    // overviewDemo now defaults afterBrowse to exerciseListView(page), so the
    // clip exercises the list's interactive paths (search → filter → View toggle
    // → paginate → page size) automatically — each step self-guarding, so a
    // missing control is skipped, not a failure. No explicit hook needed.
    await overviewDemo({ page, demo, registry, request, runId }, "agent");
  });
});
