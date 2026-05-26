// Personas — demo story (paced, recorded).
//
// Same facade, same flow as the correctness spec — but recorded with
// human pacing. Record with:
//
//   PLAYWRIGHT_DEMO=1 bun x playwright test e2e/demos/personas.story.spec.ts
//
// then polish the raw .webm:
//
//   node scripts/polish-video.mjs demo-output/personas-create-story.webm
//
// The created persona stays on screen as the closing shot; the registry
// fixture reaps it via the API *after* the video is saved — cleanup never
// appears in the recording.

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-create-story";

test.describe("demo: personas create story", () => {
  test("instructor builds a confused-student persona", async ({
    personas,
    runId,
    page,
  }) => {
    const name = `Confused Student ${runId}`;

    await personas.open();
    await personas.create({
      name,
      description:
        "A first-year who asks clarifying questions and stalls when steps are skipped.",
      instructions:
        "You are a confused freshman in office hours. Ask short, uncertain questions; only make progress when the TA gives specific, relevant guidance.",
      example: "Wait, sorry — could you explain that last step again? I'm a bit lost.",
    });

    // Close on the populated library so the new persona is the final frame.
    await personas.open();
    await personas.search(name);
    await personas.library.expectVisible(name);

    await saveDemoVideo(page, TOPIC);
  });
});
