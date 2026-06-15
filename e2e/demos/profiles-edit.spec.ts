import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
import { resolveAnyId } from "../support/factories";

const TOPIC = "profiles-edit";

// coverage: NON-DESTRUCTIVE form-tour of a REAL existing profile's edit page —
// the three-step builder (Basic Information + Contact Information + Roles),
// pre-populated with the profile's real name / departments / flags / emails /
// role. We resolve a live profile id from /profile/search and open its edit
// route, settle out the load skeleton, then walk every step top->bottom holding
// ~1s on each so its real data reads on camera. On the Basic step we reveal the
// departments grid and hover (never toggle) a flag switch; on Contact we reveal
// the populated email rows; on Roles we type into the "Search roles..." box so
// the live re-query shows then clear it, open-and-Escape the filter popover, and
// hover (never click) a role card so the role catalog reads. Every beat past the
// one page-ready assertion is guarded so a section the live data doesn't render
// is skipped cleanly. Strictly non-destructive: nothing is selected/toggled, the
// search box is typed then cleared, the filter popover is opened then dismissed,
// and the form is NEVER saved/submitted/reset/deleted/emulated — so the real
// profile is left exactly as found.
test.describe("demo: profiles edit", () => {
  test("tours a real profile's edit form: name, departments, flags, emails, role catalog", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    // Open a REAL, already-configured profile's edit page (resolved from live
    // seed data) so every step is pre-populated.
    const id = await resolveAnyId(request, "profile");
    test.skip(!id, "no seed profile to open");
    await page.goto(`/management/profiles/${id}`);
    await expectAuthenticated(page);

    // Page-ready: the multi-step profile builder form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // Name (Names header), Departments grid, and Flags. Hold so it reads.
    await holdStep(page, "basic", /^Basic Information$/i);
    // Reveal the departments selection grid; hover the first card (never click).
    await hoverIfVisible(
      page
        .getByTestId("artifact-form-step-basic")
        .getByTestId("selectable-option")
        .first(),
    );
    // Reveal the Flags toggles — hover the first switch only, never flip it, so
    // the section is on camera without committing a flag change.
    await scrollToText(page, /^Flags$/i);
    await hoverIfVisible(
      page.getByTestId("artifact-form-step-basic").getByRole("switch").first(),
    );

    // ── Contact Information ───────────────────────────────────────────
    // The profile's real emails (primary + additional). Hold so they read.
    await holdStep(page, "contact", /^Contact Information$/i);
    await hoverIfVisible(
      page
        .getByTestId("artifact-form-step-contact")
        .getByTestId("selectable-option")
        .first(),
    );

    // ── Roles ─────────────────────────────────────────────────────────
    // The role catalog. Hold on the heading, then exercise the read-only
    // affordances: search box (typed + cleared), filter popover (open+Escape),
    // and hover a role card (never click) so the catalog reads.
    await holdStep(page, "roles", /^Roles$/i);

    // Type into the "Search roles..." box so the typing + live re-query show,
    // let it settle, then clear it back to empty — read-only, commits nothing.
    await demoTypeAndClear(page, /Search roles\.\.\./i, "admin");

    // Open the filter popover (the Filter icon button in the Roles step header),
    // reveal the "Show selected" toggle, then dismiss with Escape without
    // applying it.
    await openFilterAndDismiss(page);

    // Hover the first role card so the catalog reads — clicking would change the
    // selected role into the local draft, so we deliberately only hover.
    await hoverIfVisible(
      page
        .getByTestId("artifact-form-step-roles")
        .getByTestId("selectable-option")
        .first(),
    );
    // Linger on the populated role catalog so it dominates the closing frames.
    await pauseForDemo(1100);

    // ── Action bar ────────────────────────────────────────────────────
    // Scroll the submit row into view to close the tour — NEVER clicked, so the
    // profile is never updated.
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
 * Open the Roles step filter popover (its trigger is the lone Filter icon
 * button in the roles step header), hold so the "Show selected" toggle reads,
 * then dismiss with Escape without applying any filter. Guarded on the trigger
 * being present.
 */
async function openFilterAndDismiss(page: Page): Promise<void> {
  const trigger = page
    .getByTestId("artifact-form-step-roles")
    .getByRole("button")
    .filter({ has: page.locator("svg.lucide-filter") })
    .first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
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
