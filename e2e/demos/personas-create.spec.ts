import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: personas create", () => {
  test("instructor builds a confused-student persona", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "persona", {
      name: `Confused Student ${runId}`,
      description:
        "A first-year who asks clarifying questions and stalls when steps are skipped.",
      instructions:
        "You are a confused freshman in office hours. Ask short, uncertain questions.",
      example: "Wait, sorry — could you explain that last step again?",
    });
  });
});
