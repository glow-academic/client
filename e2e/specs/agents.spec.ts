// Agents — correctness suite. Required to submit: name, description, a model,
// and a system prompt. Departments, the active flag, tools, and the
// model-capability sections are best-effort. Auto-reaped by the registry.

import { test, expect } from "../fixtures";

test.describe("agents", () => {
  test.describe.configure({ mode: "serial" });

  // Many sections, each with a deterministic draft settle (incl. the model
  // pick that reveals capability steps) — give it headroom past the 120s
  // default, like the scenario full-fill flows.
  test.beforeEach(() => test.setTimeout(180_000));

  // BLOCKED: an agent requires a prompt_id, but there are no seed prompts to
  // select (the Prompts picker is a GenericPicker dropdown, not a grid), and
  // typing prompt content into the Monaco editor does NOT resolve a prompt_id
  // on save — submit fails "Prompt selection is required" (same creatable-
  // resolution gap as a profile's new email). Unskip once the backend resolves
  // a typed prompt to a prompt_id, or seed data provides selectable prompts.
  test.skip(true, "agent prompt_id unsatisfiable: no seed prompts; typed prompt content doesn't resolve");

  test("an instructor creates an agent and sees it in the library", async ({
    agents,
    runId,
  }) => {
    const name = `Support Agent ${runId}`;

    await agents.create({
      name,
      description: "Handles tier-1 customer support with a calm, helpful tone.",
    });

    await agents.open();
    await agents.search(name);
    await expect(agents.card(name)).toBeVisible();
  });
});
