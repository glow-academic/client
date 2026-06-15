import { expect, test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-settings";

// coverage: non-destructive tour of the department builder's settings surface —
// the two-step form (Basic Information + Settings). We hold on Basic Information
// to read the Name field, open-and-Escape the Descriptions picker, and reveal
// the Flags toggles without flipping them; then we hold on the Settings step and
// hover its selectable cards so the picker grid reads on camera. Every beat past
// the one page-ready assertion is guarded so a section the live data doesn't
// render is skipped cleanly. Strictly non-destructive: the Name field is typed
// then cleared back to empty, the description picker is opened then dismissed,
// no flag/switch is toggled, no setting card is clicked, and the form is never
// submitted — so no committed setting is changed.
test.describe("demo: departments settings", () => {
  test("tours the department settings surface: fields, picker, flags, and setting cards", async ({
    page,
  }) => {
    await page.goto("/platform/departments/new");
    await expectAuthenticated(page);

    // Page-ready: the multi-step department builder form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // The opening step: name, description, and flags. Hold so it reads.
    await holdStep(page, "basic", /^Basic Information$/i);

    // Type into the Name field so the typing shows, let it settle, then clear
    // it back to empty — the create form holds only local draft state, so this
    // commits nothing and leaves the field untouched.
    await demoTypeAndClear(page, /e\.g\., Customer Success/i, "University");

    // Open the Descriptions picker to reveal the existing descriptions, hold so
    // the menu reads, then dismiss with Escape without choosing one. The picker
    // is a `role=combobox` trigger (GenericPicker) that shows "Descriptions"
    // when empty; scope to the basic step so we hit that one trigger.
    await openAndDismiss(page, () =>
      page
        .getByTestId("artifact-form-step-basic")
        .getByRole("combobox")
        .filter({ hasText: /Descriptions/i })
        .first(),
    );

    // Reveal the Flags toggles. We only hover the first switch — never flip it —
    // so the section is on camera without committing a flag change.
    await scrollToText(page, /^Flags$/i);
    await hoverIfVisible(
      page.getByTestId("artifact-form-step-basic").getByRole("switch").first(),
    );

    // ── Settings ──────────────────────────────────────────────────────
    // The settings picker step. Hold on the heading, then hover the first
    // selectable setting card so the grid reads — clicking would toggle the
    // selection into the draft, so we deliberately only hover.
    await holdStep(page, "settings", /^Settings$/i);
    await hoverIfVisible(
      page
        .getByTestId("artifact-form-step-settings")
        .getByTestId("selectable-option")
        .first(),
    );
    // Linger on the populated settings grid so it dominates the closing frames.
    await pauseForDemo(1100);

    // ── Submit row ────────────────────────────────────────────────────
    // Scroll the action bar into view to close the tour — never clicked, so
    // nothing is created.
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
 * actually rendered. No-ops cleanly when the step is absent rather than failing.
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
 * Type a value into a text field character by character so the typing is
 * visible, let it settle, then clear it back to empty so nothing is committed.
 * Guarded on the field being present.
 */
async function demoTypeAndClear(
  page: Page,
  placeholder: RegExp,
  value: string,
): Promise<void> {
  const input = page.getByPlaceholder(placeholder).first();
  if (!(await input.isVisible().catch(() => false))) return;
  await input.scrollIntoViewIfNeeded().catch(() => undefined);
  await input.click().catch(() => undefined);
  await input.pressSequentially(value, { delay: 55 }).catch(() => undefined);
  await pauseForDemo(1000);
  // Clear it so the demo leaves the field untouched.
  await input.fill("").catch(() => undefined);
  await pauseForDemo(600);
}

/**
 * Open a picker/dropdown via its trigger, hold so its options read, then
 * dismiss with Escape without committing a selection. Guarded on the trigger
 * being present.
 */
async function openAndDismiss(
  page: Page,
  trigger: () => ReturnType<Page["getByRole"]>,
): Promise<void> {
  const button = trigger();
  if (!(await button.isVisible().catch(() => false))) return;
  await button.scrollIntoViewIfNeeded().catch(() => undefined);
  await button.click().catch(() => undefined);
  await pauseForDemo(1100);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
}

/**
 * Hover a locator if it is on screen, holding a beat so it reads. Hover-only by
 * design — never clicks, so no selection/toggle is committed.
 */
async function hoverIfVisible(
  locator: ReturnType<Page["getByRole"]>,
): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.hover({ force: true }).catch(() => undefined);
  await pauseForDemo(900);
}
