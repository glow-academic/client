// Tools — correctness suite. Name is the only required field; description,
// departments, the active flag, arguments, permissions, and instructions are
// best-effort sections. Auto-reaped by the registry fixture.

import { test, expect } from "../fixtures";

test.describe("tools", () => {
  test.describe.configure({ mode: "serial" });

  test("an instructor creates a tool and sees it in the library", async ({
    tools,
    runId,
  }) => {
    const name = `Calculator ${runId}`;

    await tools.create({
      name,
      description: "Evaluates arithmetic expressions and returns the result.",
    });

    await tools.open();
    await tools.search(name);
    await expect(tools.card(name)).toBeVisible();
  });
});
