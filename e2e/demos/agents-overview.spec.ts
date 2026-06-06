import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";

test.describe("demo: agents overview", () => {
  test("browse the agents library", async ({ page, demo, registry, request, runId }) => {
    // Pilot: after the loaded grid is browsed, exercise the list's interactive
    // paths (search → filter → View toggle → paginate → page size) so the clip
    // demonstrates the affordances WORKING, not just a passive scroll. Each step
    // is self-guarding, so a missing control is skipped, not a failure.
    await overviewDemo({ page, demo, registry, request, runId }, "agent", (p) =>
      exerciseListView(p),
    );
  });
});
