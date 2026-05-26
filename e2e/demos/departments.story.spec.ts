// Department — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: departments", () => {
  test("instructor builds a department", async ({ departments, runId, page }) => {
    const name = `Customer Success ${runId}`;

    await departments.create({
      name,
      description: "Team responsible for onboarding and account health.",
    });

    await departments.open();
    await departments.search(name);
    await departments.library.expectVisible(name);

    await saveDemoVideo(page, "departments-create-story");
  });
});
