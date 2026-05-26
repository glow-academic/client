// Scenarios — correctness suite. Two modes (URL ?mode=): a contextual
// scenario (problem statement, objectives, image) and an assessment scenario
// (video, questions). Both auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("scenarios", () => {
  // These flows are draft-save-heavy (many autosave round-trips); running
  // them in parallel can exhaust the dev DB connection pool. Run serially.
  test.describe.configure({ mode: "serial" });

  // The two-mode full-fill flows are the longest in the suite — every section
  // filled, with a deterministic draft settle between each step (incl. the
  // canonical departments + active toggle). That legitimately overruns the
  // default 120s correctness budget, so give these the headroom; the submit
  // retry still bounds the tail. (Demos already run at 240s.)
  test.beforeEach(() => test.setTimeout(180_000));

  test("an instructor creates a contextual scenario", async ({
    scenarios,
    runId,
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
    await expect(scenarios.card(name)).toBeVisible();
  });

  test("an instructor creates an assessment scenario", async ({
    scenarios,
    runId,
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
    await expect(scenarios.card(name)).toBeVisible();
  });
});
