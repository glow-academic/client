import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
import { resolveAnyId } from "../support/factories";

const TOPIC = "personas-examples";

// coverage: NON-DESTRUCTIVE tour of a REAL existing persona's EXAMPLE dialogue.
// We resolve a live persona id (resolveAnyId 'persona') and open its edit route
// (/training/personas/{id}), settle out the load skeleton, then walk the
// multi-step builder top->bottom holding ~1s on each step so its real configured
// data reads on camera. The focus — distinct from personas-instructions, which
// dwells on the instructions prose — is the "Personality" (content) step's
// EXAMPLE MESSAGES section: we scroll to the "Example Messages" heading and the
// persona's real configured example-dialogue rows, hold so they read, and hover
// (never click) the "Add example" affordance so the section's control reads
// without adding a row. Every beat past the one page-ready assertion
// (artifact-form mounted) is guarded with isVisible().catch(()=>false), so a
// section the live persona doesn't render is skipped cleanly rather than
// failing. Strictly non-destructive: nothing is typed, toggled, added, removed,
// reset, or saved — the persona is left exactly as found.
test.describe("demo: personas examples", () => {
  test("tours a real persona's configured example dialogue in the Personality step", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    // Open a REAL, already-configured persona's edit page (resolved from live
    // seed data) so its example messages are pre-populated on screen.
    const id = await resolveAnyId(request, "persona");
    test.skip(!id, "no seed persona to open");
    await page.goto(`/training/personas/${id}`);
    await expectAuthenticated(page);

    // Page-ready: the multi-step persona builder form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // Brief establishing hold on the persona's name/description so the viewer
    // knows which persona this is before we descend to its examples.
    await holdStep(page, "basic", /^Basic Information$/i);

    // ── Personality (content) — THE FOCUS ─────────────────────────────
    // This step renders Instructions, then the Example Messages list, then
    // Voices. Hold on the step heading, then drive the camera onto the real
    // configured example dialogue.
    await holdStep(page, "content", /^Personality$/i);

    const contentStep = page.getByTestId("artifact-form-step-content");

    // Scroll to the "Example Messages" section heading and hold so the label —
    // the thing that names this as the example-dialogue surface — reads.
    await scrollToText(page, /^Example Messages/i);
    await pauseForDemo(1100);

    // Reveal the persona's real configured example-dialogue rows. The reorderable
    // list renders each example in a "Message" placeholder textarea pre-filled
    // with the configured text — scroll the first into view and linger so the
    // actual dialogue reads on camera. Guarded: skipped if no rows render.
    await holdLocator(
      contentStep.getByPlaceholder(/Message/i).first(),
      1400,
    );

    // Hover (never click) the "Add example" control so the section's affordance
    // reads — clicking would append an empty row, so we deliberately only hover.
    await holdLocator(
      contentStep.getByRole("button", { name: /Add example/i }).first(),
      1000,
    );

    // Linger on the populated example list so it dominates the closing frames —
    // this is what makes the clip distinctly about EXAMPLES, not instructions.
    await scrollToText(page, /^Example Messages/i);
    await pauseForDemo(1200);

    // ── Action bar ────────────────────────────────────────────────────
    // Scroll the submit row into view to close the tour — NEVER clicked, so the
    // persona is never updated.
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
 * Scroll a locator into view and hold a beat so it reads — but only if it is on
 * screen. Read-only by design: it never clicks or types, so nothing is
 * committed. No-ops cleanly when the target is absent.
 */
async function holdLocator(
  locator: ReturnType<Page["getByRole"]>,
  ms: number,
): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(ms);
}
