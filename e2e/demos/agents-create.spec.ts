import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: agents create", () => {
  test("instructor builds an agent", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "agent", {
      name: `Support Agent ${runId}`,
      description: "Handles tier-1 customer support with a calm, helpful tone.",
    });
  });
});
