import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-create";

/**
 * NON-DESTRUCTIVE form-tour of the new-simulation builder
 * (/training/simulations/new).
 *
 * The page is one scrollable two-step GenericForm whose step cards are:
 *   - "Basic Information" (artifact-form-step-basic) — the Names header, a
 *     Descriptions picker (with its own client-side "Search..." box), a
 *     Departments selectable grid, and a Flags switch row;
 *   - "Scenarios" (artifact-form-step-scenarios) — a Scenarios selectable
 *     grid with a "Search scenarios..." box + a "Show selected only" Filters
 *     popover, followed by the dependent Scenario Flags / Positions / Rubrics /
 *     Time Limits pickers that the selected scenarios render;
 * and ends with the Back / Create Simulation action row.
 *
 * COVERAGE STRATEGY — and the targeted fix: the scenarios step's search box is
 * wired through nuqs to `scenarioSearch`, which the /new page loader feeds into
 * the SSR `/simulation/get` re-query — so TYPING into it flashes a loading
 * skeleton into the recording (a prior take was flagged for exactly that). So
 * this tour exercises the scenarios step by SCROLL + HOVER only — never typing
 * into its search — and reveals its read-only "Show selected only" Filters
 * popover by open-then-Escape (the popover holds temp values and commits
 * nothing until its "Apply" button, which we never click, so it neither mutates
 * nor re-queries). Nothing is typed, selected, applied, reset, or submitted.
 *
 * Every beat past the single page-ready assertion (the artifact-form root) is
 * guarded by an isVisible().catch(() => false) check (directly or via the
 * guarded helpers), so a control the form lacks is skipped rather than failing
 * the recording. settleLoaded() runs after navigation so no loading skeleton is
 * captured, and holds land only on already-settled content.
 */
test.describe("demo: simulations create", () => {
  test("tours the new-simulation builder steps and scenario pickers without submitting", async ({
    page,
  }) => {
    // coverage: tour every step of the new-simulation form — basic info
    // (names/description/departments/flags) and scenarios (grid + dependent
    // flags/positions/rubrics/time-limits) — scrolling + hovering each section
    // and opening/dismissing the scenarios Filters popover, never typing the
    // scenario search (SSR re-query) or submitting.
    await page.goto("/training/simulations/new");
    await expectAuthenticated(page);

    // Page-ready: the two-step form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    const basic = page.getByTestId("artifact-form-step-basic");
    const scenarios = page.getByTestId("artifact-form-step-scenarios");

    // ── Basic Information ─────────────────────────────────────────────
    // Scroll the opening step into view, hold on its heading, then surface its
    // Description / Departments / Flags affordances by hover + scroll only.
    await holdStep(page, basic, /^Basic Information$/i);
    // The Description picker label + its options grid (hover only — no typing
    // into the search-bound input).
    await scrollToText(page, /^description$/i).catch(() => undefined);
    await hoverLocatorIfVisible(basic.getByTestId("selectable-option").first());
    await pauseForDemo(900);
    // The Departments selectable grid and the Flags switch row.
    await scrollToText(page, /departments/i).catch(() => undefined);
    await scrollToText(page, /flags/i).catch(() => undefined);

    // ── Scenarios ─────────────────────────────────────────────────────
    // Scroll the step in and hold on its heading, hover the scenario grid to
    // reveal options, then open/dismiss the "Show selected only" Filters
    // popover (open-then-Escape, never applied). The "Search scenarios..." box
    // is toured by presence only — NEVER typed into (SSR re-query skeleton).
    await holdStep(page, scenarios, /^Scenarios$/i);
    await hoverLocatorIfVisible(
      scenarios.getByTestId("selectable-option").first(),
    );
    await pauseForDemo(900);
    await openFilterAndEscape(page, scenarios);

    // Hold on the dependent scenario pickers the selected scenarios render —
    // each guarded so an absent section is skipped cleanly.
    await scrollToText(page, /Scenario Flags/i).catch(() => undefined);
    await scrollToText(page, /Scenario Positions/i).catch(() => undefined);
    await scrollToText(page, /Scenario Rubrics/i).catch(() => undefined);
    await scrollToText(page, /Time Limits?/i).catch(() => undefined);

    // ── Action row ────────────────────────────────────────────────────
    // Scroll the submit/back row into view to close the tour — never clicked,
    // so nothing is created or navigated away.
    const submit = page
      .locator('[data-testid="artifact-form-submit"]:visible')
      .first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    await saveDemoVideo(page, TOPIC);
  });
});

/**
 * Scroll a form step into view and hold the camera there, but only if the step
 * actually rendered. No-ops cleanly on a step that isn't in the DOM.
 */
async function holdStep(
  page: Page,
  step: ReturnType<Page["getByTestId"]>,
  heading: RegExp,
): Promise<void> {
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await scrollToText(page, heading).catch(() => undefined);
  await pauseForDemo(1_200);
}

/**
 * Open the step's Filters popover (the funnel icon next to the search box) to
 * reveal its options ("Show selected only"), hold so they read, then dismiss
 * with Escape. The popover commits nothing until its "Apply" button (never
 * clicked), so this is read-only and triggers no re-query/skeleton. Guarded on
 * both the step and the trigger being present.
 */
async function openFilterAndEscape(
  page: Page,
  step: ReturnType<Page["getByTestId"]>,
): Promise<void> {
  if (!(await step.isVisible().catch(() => false))) return;
  // The filter trigger is the icon-only button on the search row, carrying the
  // lucide Filter (funnel) svg. Scope to it so we never hit the header's Reset
  // or AI-generate buttons.
  const trigger = step.locator("button:has(svg.lucide-filter)").first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  await pauseForDemo(400);
  // Only hold if the popover content actually opened.
  const option = page.getByText(/Show selected only/i).first();
  if (await option.isVisible().catch(() => false)) {
    await pauseForDemo(1_200);
  }
  // Dismiss without applying any filter.
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(500);
}
