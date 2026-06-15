import { expect, test, type Page } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-scenario";

// The single-stage scenario builder is one long form composed of StepCards
// (`artifact-form-step-<id>`): basic → context → personas → documents →
// parameters → video. This demo tours that whole form READ-ONLY: scroll +
// hold on each step, hover each card, and open-then-Escape the per-step
// "Filters" popover WITHOUT committing (Apply is never clicked; Escape
// dismisses). We deliberately NEVER type into a StepCard search box (those
// re-query and flash a loading skeleton) and NEVER submit/reset.

const STEPS = ["basic", "context", "personas", "documents", "parameters", "video"] as const;

/** Scroll a step into view and hold a beat so it reads on the clip. No-op if
 *  the step is absent (server gating can hide context/video by mode). */
async function tourStep(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(900);
  await hoverFirstVisible(page, `artifact-form-step-${stepId}`);
}

/** Open the read-only "Filters" popover inside a step, reveal its options,
 *  then dismiss with Escape — never clicking Apply, so no re-query fires.
 *  Fully guarded: a step with no filter control is skipped. */
async function peekFilters(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  // The Filters control is the lone <button> inside the step's search-bar row
  // (the bordered flex row that also holds the <input> search field). The
  // SelectableGrid cards below it live outside this row, so this stays unique.
  const trigger = step.locator("div.border-b button").last();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  // The popover surfaces a "Show selected only" toggle + Apply button.
  const option = page.getByText(/show selected only/i).first();
  if (await option.isVisible().catch(() => false)) {
    await pauseForDemo(900);
  }
  // Dismiss WITHOUT applying — Escape closes the popover, no mutation.
  await page.keyboard.press("Escape");
  await pauseForDemo(500);
}

test.describe("demo: tutorial scenario", () => {
  test("tours the single-stage scenario builder form read-only", async ({ page }) => {
    // coverage: scroll every step top->bottom, hover each card, open+Escape
    // the per-step Filters popover (no Apply), never type search / never submit.
    await openArtifactForm(page, "/training/scenarios/new");

    // Page-ready assertion (the one hard assertion); everything after is guarded.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Establish the top of the form: the name + description of step one.
    await scrollToText(page, /new scenario|describe the scenario|customer support/i);
    await pauseForDemo(700);

    // Tour every step top -> bottom with a hold + hover on each.
    for (const stepId of STEPS) {
      await tourStep(page, stepId);
    }

    // Re-visit the resource-picker steps to open + dismiss their Filters popover.
    await peekFilters(page, "personas");
    await peekFilters(page, "documents");
    await peekFilters(page, "parameters");

    // Settle back at the top so the clip ends on a clean, populated form.
    await page.getByTestId("artifact-form-step-basic").scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
