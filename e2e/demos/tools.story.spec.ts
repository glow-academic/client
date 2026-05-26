// Tool — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: tools", () => {
  test("instructor builds a tool", async ({ tools, runId, page }) => {
    const name = `Calculator ${runId}`;

    await tools.create({
      name,
      description: "Evaluates arithmetic expressions and returns the result.",
    });

    await tools.open();
    await tools.search(name);
    await tools.library.expectVisible(name);

    await saveDemoVideo(page, "tools-create-story");
  });
});
