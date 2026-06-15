import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-create";

/**
 * NON-DESTRUCTIVE form-tour of the new-scenario builder
 * (/training/scenarios/new).
 *
 * The page is one scrollable multi-step GenericForm whose step cards are:
 *   - "Basic Information" (artifact-form-step-basic) — the scenario Name
 *     (creatable), a Description picker, a Departments selectable grid, a
 *     Flags switch row, and a Contextual / Assessment mode toggle;
 *   - "Personas" (artifact-form-step-personas) — a persona selectable grid
 *     with a search box + a "Show selected only" Filters popover;
 *   - "Documents" (artifact-form-step-documents) — a document selectable
 *     grid with the same search box + Filters popover;
 *   - "Parameters" (artifact-form-step-parameters) — a parameter selectable
 *     grid with a "Search parameters..." box + Filters popover;
 * and ends with the Back / Save Scenario action row.
 *
 * COVERAGE STRATEGY — and the targeted fix: every StepCard search box is
 * wired through nuqs to a URL param that drives an SSR re-query, so TYPING
 * into any of them (personas / documents / parameters / the basic-step
 * Description) flashes a loading skeleton into the recording. A prior take
 * was flagged for exactly that on the documents step. So this tour exercises
 * the search-bearing steps by SCROLL + HOVER only — never typing into a
 * search box — and reveals each step's read-only Filters popover by
 * open-then-Escape (the popover holds temp values and commits nothing until
 * its "Apply" button, which we never click, so it neither mutates nor
 * re-queries). Nothing is typed, selected, applied, or submitted.
 *
 * Every beat past the single page-ready assertion (the artifact-form root)
 * is guarded by an isVisible().catch(() => false) check (directly or via the
 * guarded helpers), so a control the form lacks is skipped rather than
 * failing the recording. settleLoaded() runs after navigation, and again is
 * implied by holding only on already-settled content, so no loading skeleton
 * is captured.
 */
test.describe("demo: scenarios create", () => {
  test("tours the new-scenario builder steps and pickers without submitting", async ({
    page,
  }) => {
    // coverage: tour every step of the new-scenario form — basic info,
    // personas, documents, parameters — scrolling + hovering each grid and
    // opening/dismissing each Filters popover, never typing a search or
    // submitting.
    await page.goto("/training/scenarios/new");
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    const basic = page.getByTestId("artifact-form-step-basic");
    const personas = page.getByTestId("artifact-form-step-personas");
    const documents = page.getByTestId("artifact-form-step-documents");
    const parameters = page.getByTestId("artifact-form-step-parameters");

    // Open-then-dismiss the Filters popover of a step WITHOUT applying. The
    // trigger is the ghost icon-button in the step's search row; the popover
    // commits nothing until its "Apply" button (never clicked), so this is
    // read-only and triggers no re-query/skeleton.
    const tourFilters = async (step: ReturnType<typeof page.getByTestId>) => {
      const trigger = step.getByRole("button").filter({ has: page.locator("svg") }).last();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click().catch(() => undefined);
        // Hold so the "Show selected only" option + Apply read on camera.
        await pauseForDemo(1_300);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }
    };

    // Reveal a step's selectable grid by hovering its first option (no commit).
    const tourGrid = async (step: ReturnType<typeof page.getByTestId>) => {
      await hoverLocatorIfVisible(step.getByTestId("selectable-option").first());
      await pauseForDemo(900);
    };

    // Beat 1: the Basic Information card heading.
    await scrollToText(page, /basic information/i).catch(() => undefined);
    if (await basic.isVisible().catch(() => false)) {
      await basic.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // Beat 2: surface the Description picker label (read-only — no typing into
    // the search-bound input, which would re-query).
    await scrollToText(page, /^description$/i).catch(() => undefined);

    // Beat 3: reveal the Departments option grid by hovering the first option.
    await hoverLocatorIfVisible(basic.getByTestId("selectable-option").first());
    await pauseForDemo(900);

    // Beat 4: surface the Flags switch row + the Contextual/Assessment mode
    // toggle without flipping anything.
    await scrollToText(page, /flags/i).catch(() => undefined);
    await scrollToText(page, /contextual/i).catch(() => undefined);

    // Beat 5: the Personas step — scroll its heading in, hover its grid, and
    // open/dismiss its Filters popover. Search box toured by hover only.
    await scrollToText(page, /^personas$/i).catch(() => undefined);
    if (await personas.isVisible().catch(() => false)) {
      await personas.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }
    await tourGrid(personas);
    await tourFilters(personas);

    // Beat 6: the Documents step — SCROLL + HOVER only (the prior take's
    // skeleton flash was the documents search re-query; no typing here).
    await scrollToText(page, /^documents$/i).catch(() => undefined);
    if (await documents.isVisible().catch(() => false)) {
      await documents.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }
    await tourGrid(documents);
    await tourFilters(documents);

    // Beat 7: the Parameters step — scroll heading in, hover its grid, and
    // open/dismiss its "Search parameters..." Filters popover. No typing.
    await scrollToText(page, /^parameters$/i).catch(() => undefined);
    if (await parameters.isVisible().catch(() => false)) {
      await parameters.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }
    await tourGrid(parameters);
    await tourFilters(parameters);

    // Beat 8: scroll the submit action row into view — show "Save Scenario" —
    // but NEVER click it. The tour ends without creating anything.
    const submit = page.locator('[data-testid="artifact-form-submit"]:visible').first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
