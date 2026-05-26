// Scenarios — demo stories (paced, recorded). One per mode, so each video
// tells a single clear story. Record with:
//   PLAYWRIGHT_DEMO=1 bun x playwright test e2e/demos/scenarios.story.spec.ts
// then polish demo-output/scenarios-*.webm with scripts/polish-video.mjs.

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: scenarios", () => {
  test("instructor builds a contextual scenario", async ({
    scenarios,
    runId,
    page,
  }) => {
    const name = `Customer Escalation ${runId}`;

    await scenarios.create(
      {
        name,
        description: "A frustrated customer escalates a billing dispute.",
        problemStatement:
          "The customer was double-charged and wants an immediate refund.",
        objective: "De-escalate the customer and resolve the billing issue.",
      },
      "contextual",
    );

    await scenarios.open();
    await scenarios.search(name);
    await scenarios.library.expectVisible(name);

    await saveDemoVideo(page, "scenarios-contextual-story");
  });

  test("instructor builds a video assessment scenario", async ({
    scenarios,
    runId,
    page,
  }) => {
    const name = `Triage Assessment ${runId}`;

    await scenarios.create(
      {
        name,
        description: "Assess how the trainee opens a tense support call.",
        question: "What should you say first to de-escalate the customer?",
      },
      "assessment",
    );

    await scenarios.open();
    await scenarios.search(name);
    await scenarios.library.expectVisible(name);

    await saveDemoVideo(page, "scenarios-assessment-story");
  });
});
