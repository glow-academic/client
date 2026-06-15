import { type Locator, type Page } from "@playwright/test";

import { test, expect } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-args";

// coverage: tools-args — FOCUS a real tool's ARGUMENTS. We resolve an existing
// tool from the backend and open its edit page (`/intelligence/tools/{id}`),
// which hydrates the multi-step form with the tool's saved data. We hold
// briefly on Basic Information for context, then center the tour on the
// Arguments step (`artifact-form-step-arguments`): scroll it on camera, hold so
// the configured argument rows read (each shows its name + `field_type ·
// required · N outputs` subtitle), hover the argument rows one by one so the
// camera reads each, glance at the live Arguments preview panel, then reveal
// the "Add Argument" affordance WITHOUT clicking it. We close by scrolling the
// (never-clicked) submit row into view.
//
// Strictly NON-DESTRUCTIVE against the LIVE instance: nothing is typed into a
// persisted field, "Add Argument" is only revealed (clicking it seeds a local
// draft row — out of scope), and the form is never saved or submitted. Every
// beat past the single page-ready assertion is guarded (isVisible().catch(() =>
// false)) so an affordance the live tool doesn't render no-ops cleanly. After
// navigation we settleLoaded() so no loading skeleton is captured.
test.describe("demo: tools args", () => {
  test("tours a real tool's configured arguments — names, types, descriptions", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    // Resolve a real, already-existing tool from the seed data — its edit page
    // renders pre-populated with whatever arguments it has configured. No
    // create/seed: we tour what's there.
    const toolId = await resolveAnyId(request, "tool");
    test.skip(!toolId, "no existing tool to tour (tools library is empty)");

    await page.goto(`/intelligence/tools/${toolId}`);
    await expectAuthenticated(page);

    // Page-ready: the multi-step edit form is mounted with the tool's data.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the opening frames.
    await settleLoaded(page);

    // ── Basic Information (brief context) ─────────────────────────────
    // A quick hold on the opening step so the viewer knows which tool we are
    // looking at before we dive into its arguments.
    await holdStep(page, "basic", /^Basic Information$/i);

    // ── Arguments (the focus of this tour) ────────────────────────────
    // Scroll the Arguments step on camera and hold so its configured rows read.
    const argsStep = page.getByTestId("artifact-form-step-arguments");
    if (await argsStep.isVisible().catch(() => false)) {
      await argsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /^Arguments$/i);
      await pauseForDemo(1300);

      // Surface the step's description copy ("Define each argument, its
      // position, and the output templates it feeds.") so the intent reads.
      await scrollToText(page, /position.*output templates/i);

      // Hover each configured argument row in turn. Saved rows render as
      // bordered cards inside the step (name + `field_type · required · N
      // outputs` subtitle); hovering reads each on camera. Guarded + capped.
      const rows = argsStep.locator("div.rounded-md.border.p-4");
      const rowCount = await rows.count().catch(() => 0);
      const toTour = Math.min(rowCount, 4);
      for (let i = 0; i < toTour; i++) {
        const row = rows.nth(i);
        if (!(await row.isVisible().catch(() => false))) continue;
        await row.scrollIntoViewIfNeeded().catch(() => undefined);
        await row.hover().catch(() => undefined);
        await pauseForDemo(900);
      }

      // Glance at the live Arguments preview panel, which mirrors each argument
      // with its field_type as a mock input — reinforces what's configured.
      await scrollToText(page, /preview/i);

      // Reveal the "Add Argument" affordance so the viewer sees how a new
      // argument would be defined — but DO NOT click it (a click seeds a local
      // draft row, which mutates the form's working state).
      const addArg = argsStep.getByRole("button", { name: /add argument/i }).first();
      if (await addArg.isVisible().catch(() => false)) {
        await addArg.scrollIntoViewIfNeeded().catch(() => undefined);
        await addArg.hover().catch(() => undefined);
        await pauseForDemo(1100);
      } else {
        // Empty-state tools have no rows but still show the "Add Argument" copy.
        await scrollToText(page, /add argument/i);
      }
    }

    // ── Submit row ────────────────────────────────────────────────────
    // Scroll the action bar into view to close the tour. It is NEVER clicked,
    // so the tool is left exactly as it was found.
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, TOPIC);
  });
});

/**
 * Scroll a form step into view and hold the camera there, but only if the step
 * actually rendered. Guarded so a step the live tool doesn't surface no-ops
 * rather than failing.
 */
async function holdStep(
  page: Page,
  stepId: string,
  heading: RegExp,
): Promise<void> {
  const step: Locator = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await scrollToText(page, heading);
  await pauseForDemo(1200);
}
