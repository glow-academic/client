import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { DOMAINS } from "../actions/domains";
import { resolveAnyId } from "../support/factories";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: scenarios-edit — NON-DESTRUCTIVE edit form-tour.
//
// Resolve a real, already-configured scenario, open its EDIT page (the
// pre-populated GenericForm), and tour every step/section top-to-bottom showing
// the REAL existing data. Every beat past the single page-ready assertion
// no-ops if its target is absent (visibleSoon / count guards), and pickers are
// opened-then-Escaped — NO field edits are committed and Save/Delete is never
// clicked. This is a read-only walkthrough, safe against the LIVE instance.

const SCENARIO_STEPS = ["basic", "personas", "documents", "parameters", "context", "video"];

/** True if a locator becomes visible within a short window. Bounded so an
 *  absent affordance is skipped, not waited out to the test timeout. */
async function visibleSoon(locator: Locator, timeout = 2_500): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

/** Scroll a step card into view and hold a beat so its real content reads. */
async function tourStep(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await visibleSoon(step))) return; // a conditional step (context/video) may not render
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(1_000);

  // Hover the first existing selection in the step so the populated picker reads.
  const option = step.getByTestId("selectable-option").first();
  if (await option.isVisible().catch(() => false)) {
    await option.scrollIntoViewIfNeeded().catch(() => undefined);
    await option.hover().catch(() => undefined);
    await pauseForDemo(700);
  }
}

/** Open a picker/search input, let it react, then Escape WITHOUT committing.
 *  Best-effort: a step that lacks the input is skipped cleanly. */
async function peekSearch(page: Page, placeholder: RegExp, query: string): Promise<void> {
  const input = page.getByPlaceholder(placeholder).first();
  if (!(await visibleSoon(input))) return;
  await input.scrollIntoViewIfNeeded().catch(() => undefined);
  await input.click().catch(() => undefined);
  await input.pressSequentially(query, { delay: 55 }).catch(() => undefined);
  await pauseForDemo(900); // let the picker re-query / re-filter on camera
  // Non-destructive reset: clear what we typed so no field edit is committed.
  await input.fill("").catch(() => undefined);
  await input.press("Escape").catch(() => undefined);
  await pauseForDemo(500);
}

test.describe("demo: scenarios edit", () => {
  test("edit a scenario", async ({ page, request, runId: _runId }) => {
    test.setTimeout(180_000);

    const spec = DOMAINS["scenario"]!;

    // Resolve a real, already-configured scenario (seed data) and open its
    // edit page — the [scenarioId] route renders the same GenericForm in edit
    // mode, pre-populated with the scenario's saved name/description/flags/
    // departments/personas/documents.
    const id = await resolveAnyId(request, "scenario");
    test.skip(!id, "no seed scenario to open for the edit tour");

    await page.goto(`${spec.listPath}/${id}`);
    await expectAuthenticated(page);

    // The single page-ready assertion: the pre-populated form is on screen.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Settle past the loading skeleton so no skeleton frame is recorded, then
    // hold on the loaded, populated form.
    await waitOutSkeleton(page);
    await settleLoaded(page);

    // ── Step 1: Basic Information ───────────────────────────────────────────
    // Name, description, departments, flags, and the Contextual/Assessment mode
    // toggle — all carrying the scenario's real saved values.
    await tourStep(page, "basic");
    // The description picker exposes a search box; type, let it filter, clear.
    await peekSearch(page, /describe the scenario/i, "support");
    // The Contextual/Assessment mode radiogroup — scroll it into view to read
    // the current mode; we do NOT click it (switching modes mutates flag_ids).
    await scrollToText(page, /contextual|assessment/i).catch(() => undefined);

    // ── Remaining steps: Personas, Documents, Parameters, and the conditional
    // Context / Video steps. Each is guarded — a step the scenario doesn't
    // enable simply doesn't render and is skipped.
    for (const stepId of SCENARIO_STEPS.slice(1)) {
      await tourStep(page, stepId);
    }

    // The Context step (if enabled) carries a Problem Statement with its own
    // search box — peek + clear it non-destructively.
    await peekSearch(page, /define the core problem/i, "issue");

    // ── Save row ────────────────────────────────────────────────────────────
    // Scroll the action row (Back + Save Scenario) into view so it reads, but
    // NEVER click it — this is a read-only tour, no update is committed.
    const submit = page.locator('[data-testid="artifact-form-submit"]:visible').first();
    if (await visibleSoon(submit)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, "scenarios-edit");
  });
});
