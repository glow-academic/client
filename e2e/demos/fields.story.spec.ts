// Field — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: fields", () => {
  test("instructor builds a field", async ({ fields, runId, page }) => {
    const name = `Learning Style ${runId}`;

    await fields.create({
      name,
      description: "How the learner prefers to absorb material.",
    });

    await fields.open();
    await fields.search(name);
    await fields.library.expectVisible(name);

    await saveDemoVideo(page, "fields-create-story");
  });
});
