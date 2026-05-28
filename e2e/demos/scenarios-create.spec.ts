import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: scenarios create", () => {
  test("instructor builds a contextual scenario", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "scenario", {
      name: `Customer Escalation ${runId}`,
      description: "A frustrated customer escalates a billing dispute.",
      problemStatement:
        "The customer was double-charged and wants an immediate refund.",
      objective: "De-escalate the customer and resolve the billing issue.",
    }, "contextual");
  });
});
