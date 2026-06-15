import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-simulation";

/**
 * NON-DESTRUCTIVE form-tour of the new-simulation builder
 * (/training/simulations/new).
 *
 * The page is one scrollable multi-step GenericForm whose step cards are:
 *   - "Basic Information" (artifact-form-step-basic) — the simulation Name
 *     (creatable header field), a Description picker, a Departments selectable
 *     grid, and a Flags switch row;
 *   - "Scenarios" (artifact-form-step-scenarios) — a Scenarios selectable grid
 *     (data-testid="picker-scenarios") with a "Search scenarios..." box + a
 *     "Show selected only" Filters popover, followed by the per-scenario
 *     Scenario Flags / Positions / Rubrics / Time Limits pickers;
 * and ends with the Back / Create Simulation action row.
 *
 * COVERAGE STRATEGY — and the targeted fix: a prior take was flagged as a
 * SINGLE-STAGE tour that only filled the name and showed the scenarios step.
 * This take instead tours BOTH steps top-to-bottom by SCROLL + HOVER, opening
 * each picker read-only. The scenarios StepCard search box is wired through
 * nuqs to a URL param that drives an SSR re-query, so typing into it would
 * flash a loading skeleton; we therefore exercise it by scroll + hover only —
 * never typing — and reveal the "Show selected only" Filters popover by
 * open-then-Escape (the popover holds temp values and commits nothing until an
 * "Apply" button we never click, so it neither mutates nor re-queries).
 * Nothing is typed, selected, applied, or submitted.
 *
 * Every beat past the single page-ready assertion (the artifact-form root) is
 * guarded by an isVisible().catch(() => false) check (directly or via the
 * guarded helpers), so a control the form lacks is skipped rather than failing
 * the recording. settleLoaded() runs after the single navigation so no loading
 * skeleton is captured.
 */
test.describe("demo: tutorial simulation", () => {
  test("tours the new-simulation builder steps and pickers without submitting", async ({
    page,
  }) => {
    // coverage: tour both steps of the new-simulation form — basic info and
    // scenarios — scrolling + hovering each picker grid and opening/dismissing
    // the scenarios Filters popover, never typing a search or submitting.
    await page.goto("/training/simulations/new");
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    const basic = page.getByTestId("artifact-form-step-basic");
    const scenarios = page.getByTestId("artifact-form-step-scenarios");

    // Open-then-dismiss a step's Filters popover WITHOUT applying. The trigger
    // is the ghost icon-button in the step's search row; the popover commits
    // nothing until its "Apply" button (never clicked), so this is read-only
    // and triggers no re-query/skeleton.
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

    // Beat 3: reveal the Departments option grid by hovering its first option.
    await hoverLocatorIfVisible(basic.getByTestId("selectable-option").first());
    await pauseForDemo(900);

    // Beat 4: surface the Flags switch row without flipping anything.
    await scrollToText(page, /flags/i).catch(() => undefined);

    // Beat 5: the Scenarios step — scroll its heading in, hover its scenario
    // grid, and open/dismiss its "Show selected only" Filters popover. The
    // "Search scenarios..." box is toured by hover only (typing would re-query).
    await scrollToText(page, /^scenarios$/i).catch(() => undefined);
    if (await scenarios.isVisible().catch(() => false)) {
      await scenarios.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }
    const scenarioPicker = page.getByTestId("picker-scenarios");
    if (await scenarioPicker.isVisible().catch(() => false)) {
      await scenarioPicker.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }
    await tourGrid(scenarios);
    await tourFilters(scenarios);

    // Beat 6: scroll the per-scenario configuration pickers into view — the
    // Scenario Flags / Positions / Rubrics / Time Limits sections — so the
    // depth of a bundled simulation reads on camera. No selections made.
    await scrollToText(page, /scenario positions/i).catch(() => undefined);
    await scrollToText(page, /scenario rubrics/i).catch(() => undefined);
    await scrollToText(page, /scenario time limits/i).catch(() => undefined);

    // Beat 7: scroll the submit action row into view — show "Create Simulation"
    // — but NEVER click it. The tour ends without creating anything.
    const submit = page.locator('[data-testid="artifact-form-submit"]:visible').first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
