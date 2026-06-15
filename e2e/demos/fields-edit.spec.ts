import { type Page } from "@playwright/test";

import { test, expect } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-edit";

// coverage: open a REAL existing field's edit page (pre-populated from the
// backend) and tour the whole form top->bottom without ever mutating it. We
// hold on the Basic Information step (name / description / departments / flags
// showing the field's real data), open-then-Escape the description picker, then
// hold on the Conditional Parameters step and exercise its read-only search
// (type char-by-char so the filter shows, let it react, clear it) and open the
// Show-selected filter popover then dismiss it. Finally we scroll the submit
// row into view WITHOUT clicking it. Every beat past the one page-ready
// assertion is guarded (isVisible().catch) so a section the live field doesn't
// render is skipped cleanly. Strictly non-destructive: nothing is saved,
// submitted, or deleted, and every typed value is cleared before we move on.
test.describe("demo: fields edit", () => {
  test("tours a field's edit form: real data, pickers, search — never saves", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    // Resolve a real, already-existing field from the seed data — its edit page
    // renders pre-populated. No create/seed: we tour what's there.
    const fieldId = await resolveAnyId(request, "field");
    test.skip(!fieldId, "no existing field to tour (fields library is empty)");

    await page.goto(`/management/fields/${fieldId}`);
    await expectAuthenticated(page);

    // Page-ready: the multi-step edit form is mounted with the field's data.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the opening frames.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // The opening step: name + description + departments + flags, all showing
    // the field's real saved values. Hold so they read.
    await holdStep(page, "basic", /^Basic Information$/i);

    // Open the Description picker (combobox) to reveal the saved/other
    // descriptions, then Escape — read-only, nothing committed.
    await openAndEscape(page, "basic", page.getByRole("combobox").first());

    // ── Conditional Parameters ────────────────────────────────────────
    // The second step: parameters surfaced when this field is selected. Hold,
    // then exercise its search and Show-selected filter (both read-only).
    await holdStep(page, "conditional", /^Conditional Parameters$/i);
    await demoSearch(
      page,
      "conditional",
      "Search conditional parameters...",
      "level",
    );
    await openFilterPopover(
      page,
      "conditional",
      "Search conditional parameters...",
    );

    // ── Submit row ────────────────────────────────────────────────────
    // Scroll the action bar into view to close the tour. It is NEVER clicked,
    // so the field is left exactly as it was found.
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
 * actually rendered. Guarded so a step the live field doesn't surface no-ops
 * rather than failing.
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
 * Open a picker/combobox inside a step to reveal its options, hold so the list
 * reads, then dismiss with Escape — committing nothing. Guarded on both the
 * step and the trigger being present.
 */
async function openAndEscape(
  page: Page,
  stepId: string,
  trigger: import("@playwright/test").Locator,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const target = trigger.first();
  if (!(await target.isVisible().catch(() => false))) return;
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click().catch(() => undefined);
  // Let the options panel render and read on camera.
  await pauseForDemo(1100);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
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
 * Open the step's filter popover (the Filter icon button that sits in the
 * search row next to the search input), reveal the "Show selected" toggle, then
 * dismiss with Escape WITHOUT applying — committing nothing. Scoped to the row
 * holding the search box so it targets the filter trigger and never the
 * (header) AI-generate button. Guarded on the step and the trigger.
 */
async function openFilterPopover(
  page: Page,
  stepId: string,
  searchPlaceholder: string,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const search = step.getByPlaceholder(searchPlaceholder).first();
  if (!(await search.isVisible().catch(() => false))) return;
  // The Filter <Button> is the icon-only button in the same flex row as the
  // search input — i.e. a button under the input's parent container.
  const trigger = search
    .locator("xpath=following-sibling::*//button | following::button[1]")
    .first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  // Hold so the popover's filter options read.
  await pauseForDemo(1100);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
}
