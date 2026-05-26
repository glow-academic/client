// Documents — correctness suite. Name is the only required field; fields,
// file/image uploads, and text content are best-effort sections.

import { test, expect } from "../fixtures";

test.describe("documents", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a document and sees it in the library", async ({
    documents,
    runId,
  }) => {
    const name = `Course Syllabus ${runId}`;

    await documents.create({
      name,
      description: "Syllabus and reference material for the course.",
      text: "Week 1: Introduction and course overview.",
    });

    await documents.open();
    await documents.search(name);
    await expect(documents.card(name)).toBeVisible();
  });
});
