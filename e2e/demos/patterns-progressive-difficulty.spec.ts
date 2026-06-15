import { expect, type Page, test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-progressive-difficulty";

// coverage: tour the whole new-simulation draft form top->bottom — both wizard
// steps (Basic Information + Scenarios), the scenario search box (type + clear),
// the read-only "Show selected only" filter popover (open + dismiss), and every
// scenario sub-picker (scenarios, flags, positions, rubrics, time limits) — all
// non-destructively. Nothing is committed: the form is never submitted and the
// filter is opened then dismissed without Apply.

/** Hover the first match of any of the given testids if present (guarded). */
async function hoverAny(page: Page, testIds: Array<string | RegExp>): Promise<void> {
  for (const id of testIds) await hoverFirstVisible(page, id);
}

/** Type into a placeholder-targeted input so the keystrokes show, then clear. */
async function tourSearch(page: Page, placeholder: RegExp, query: string): Promise<void> {
  const input = page.getByPlaceholder(placeholder).first();
  if (!(await input.isVisible().catch(() => false))) return;
  await input.scrollIntoViewIfNeeded().catch(() => undefined);
  await input.click().catch(() => undefined);
  await input.pressSequentially(query, { delay: 55 });
  await pauseForDemo(900);
  await input.fill("");
  await pauseForDemo(600);
}

/** Open the StepCard filter popover, reveal the toggle, dismiss without Apply. */
async function tourFilterPopover(page: Page): Promise<void> {
  const trigger = page.getByRole("button", { name: /filter/i }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  // Reveal the read-only "Show selected only" option so it reads on frame…
  await scrollToText(page, /show selected only/i);
  await pauseForDemo(900);
  // …then dismiss WITHOUT Apply so no filter is committed.
  await page.keyboard.press("Escape");
  await pauseForDemo(500);
}

test.describe("demo: patterns progressive difficulty", () => {
  test("tours scenario ordering inside a simulation draft", async ({ page }) => {
    // Page-ready assertion lives in openArtifactForm (waits for artifact-form).
    await openArtifactForm(page, "/training/simulations/new");
    // Trim the skeleton lead-in so the populated form fills the opening frames.
    await settleLoaded(page);

    // ── Step 1: Basic Information ────────────────────────────────────────
    await showFormStep(page, "basic");
    await scrollToText(page, /basic information/i);
    // Reveal the name field — its input carries the "Simulation name" placeholder.
    const nameField = page.getByPlaceholder(/simulation name/i).first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();
    }
    await scrollToText(page, /description|department|flags/i);

    // ── Step 2: Scenarios ────────────────────────────────────────────────
    await showFormStep(page, "scenarios");
    await scrollToText(page, /scenarios/i);

    // Search box: type a query so the keystrokes show, react, then clear.
    await tourSearch(page, /search scenarios/i, "office hours");

    // Read-only view filter: open the popover, reveal "Show selected only",
    // dismiss with Escape (never Apply — non-mutating).
    await tourFilterPopover(page);

    // Tour each scenario sub-picker top->bottom, ~1s hold on each.
    await hoverAny(page, ["picker-scenarios", "picker-scenario-rubrics"]);
    await scrollToText(page, /scenario positions|positions/i);
    await scrollToText(page, /scenario rubrics|rubrics/i);
    await scrollToText(page, /time limits|time limit/i);

    // End on the submit row so the wizard's create/back actions read — but
    // NEVER click submit (live instance; non-destructive only).
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await expect(submit).toBeVisible();
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
