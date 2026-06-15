import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
import { resolveAnyId } from "../support/factories";
import { apiCreate, resolveId } from "../support/setup";

const TOPIC = "simulations-edit";

// coverage: NON-DESTRUCTIVE tour of a REAL existing simulation's edit page,
// pre-populated from seed data (or an API-seeded fallback so the form is never
// empty). Settle out the skeleton, then walk the two-step builder top->bottom:
//   - Basic Information — name + description, plus the step's description search
//     (type char-by-char so the filtering shows, let it react, clear it);
//   - Scenarios — the scenario search (type/react/clear) and the "Show selected
//     only" Filter popover (open to reveal options, then Escape — never toggled),
//     holding on the dependent flags / positions / rubrics / time-limit pickers
//     that the real data renders;
//   - the submit row, scrolled into view only.
// Every beat past the one page-ready assertion is guarded on its target being
// visible, so a control the live data doesn't render is skipped, not failed. The
// form is NEVER saved, submitted, reset, or deleted — strictly read-only.
test.describe("demo: simulations edit", () => {
  test("tours a real simulation's edit form: steps, searches, and scenario pickers", async ({
    page,
    request,
    registry,
    runId,
  }) => {
    test.setTimeout(180_000);

    // Prefer a real, already-configured simulation from seed data so the form
    // shows genuine populated steps. Fall back to API-seeding one (tracked for
    // auto-reap) so the demo still has a populated edit page to tour when the
    // library is empty.
    let id = await resolveAnyId(request, "simulation");
    if (!id) {
      const name = `Edit simulation ${runId}`;
      test.skip(
        !(await apiCreate(request, "simulation", name)),
        "simulation not API-creatable and none seeded",
      );
      registry.track({ kind: "simulation", name });
      id = await resolveId(request, "simulation", name);
    }
    test.skip(!id, "could not resolve a simulation to edit");

    await page.goto(`/training/simulations/${id}`);
    await expectAuthenticated(page);

    // Page-ready: the multi-step edit form is mounted with the real data.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // The opening step: the pre-populated name + description and the step's
    // description search box. Hold so the real values read, then exercise the
    // search (type/react/clear) without committing anything.
    await holdStep(page, "basic", /^Basic Information$/i);
    await demoSearch(page, "basic", "Search...", "case");

    // ── Scenarios ─────────────────────────────────────────────────────
    // The configured scenarios + their dependent flag / position / rubric /
    // time-limit pickers. Scroll the step on camera, exercise its scenario
    // search (type/react/clear), and open the "Show selected only" filter
    // popover to reveal the option, then dismiss with Escape (never toggled).
    await holdStep(page, "scenarios", /^Scenarios$/i);
    await demoSearch(page, "scenarios", "Search scenarios...", "intro");
    await openFilterAndEscape(page, "scenarios");

    // Hold on the dependent scenario pickers the real data renders — each is
    // guarded so an absent section is skipped cleanly.
    await scrollToText(page, /Scenario Flags/i).catch(() => undefined);
    await scrollToText(page, /Scenario Positions/i).catch(() => undefined);
    await scrollToText(page, /Scenario Rubrics/i).catch(() => undefined);
    await scrollToText(page, /Time Limits?/i).catch(() => undefined);

    // ── Action row ────────────────────────────────────────────────────
    // Scroll the submit/back row into view to close the tour — never clicked,
    // so nothing is saved or navigated away.
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1000);
    }

    await saveDemoVideo(page, TOPIC);
  });
});

/**
 * Scroll a form step into view and hold the camera there, but only if the step
 * actually rendered. No-ops cleanly on a step that isn't in the DOM. Reuses
 * scrollToText's scroll+pause and adds an explicit hold so the section is
 * unmistakably on camera.
 */
async function holdStep(
  page: Page,
  stepId: string,
  heading: RegExp,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await scrollToText(page, heading);
  await pauseForDemo(1200);
}

/**
 * Exercise a step's read-only search box: focus it, type a query character by
 * character so the typing is visible, let the list re-filter, then clear it so
 * no state is committed. Guarded on both the step and the input being present.
 */
async function demoSearch(
  page: Page,
  stepId: string,
  placeholder: string,
  query: string,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const search = step.getByPlaceholder(placeholder).first();
  if (!(await search.isVisible().catch(() => false))) return;
  await search.scrollIntoViewIfNeeded().catch(() => undefined);
  await search.click().catch(() => undefined);
  await search.pressSequentially(query, { delay: 55 }).catch(() => undefined);
  // Let the list re-filter on the typed query.
  await pauseForDemo(1100);
  // Clear it so the demo leaves the form untouched.
  await search.fill("").catch(() => undefined);
  await pauseForDemo(700);
}

/**
 * Open the step's Filter popover (the funnel icon next to the search box) to
 * reveal its options ("Show selected only"), hold so they read, then dismiss
 * with Escape. The checkbox is NEVER toggled and nothing is applied — purely a
 * reveal-then-dismiss. Guarded on both the step and the trigger being present.
 */
async function openFilterAndEscape(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
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
    await pauseForDemo(1100);
  }
  // Dismiss without applying any filter.
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(500);
}
