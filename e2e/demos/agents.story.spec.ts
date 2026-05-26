// Agent — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: agents", () => {
  test("instructor builds an agent", async ({ agents, runId, page }) => {
    const name = `Support Agent ${runId}`;

    await agents.create({
      name,
      description: "Handles tier-1 customer support with a calm, helpful tone.",
    });

    await agents.open();
    await agents.search(name);
    await agents.library.expectVisible(name);

    await saveDemoVideo(page, "agents-create-story");
  });
});
