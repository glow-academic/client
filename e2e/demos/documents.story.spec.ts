// Document — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: documents", () => {
  test("instructor builds a document", async ({ documents, runId, page }) => {
    const name = `Course Syllabus ${runId}`;

    await documents.create({
      name,
      description: "Syllabus and reference material for the course.",
      text: "Week 1: Introduction and course overview.",
    });

    await documents.open();
    await documents.search(name);
    await documents.library.expectVisible(name);

    await saveDemoVideo(page, "documents-create-story");
  });
});
